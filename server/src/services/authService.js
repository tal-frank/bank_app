// All the authentication RULES live here. This file knows nothing about HTTP:
// no req, no res, no cookies. It takes plain values, returns plain values,
// and throws AppError when a rule says no. That keeps it easy to read and
// easy to test (Phase 12) without starting a server.
//
// The controller (controllers/authController.js) does the HTTP part:
// reads the request, calls these functions, sets the cookie, sends JSON.
import { randomInt } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import * as userRepo from '../repositories/userRepo.js';
import * as refreshTokenRepo from '../repositories/refreshTokenRepo.js';
import { DuplicateEmailError } from '../repositories/errors.js';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../utils/password.js';
import { generateOtp, hashOtp, verifyOtpCode } from '../utils/otp.js';
import {
  signAccessToken,
  createRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from '../utils/tokens.js';
import { toPublicUser } from '../utils/toPublicUser.js';
import { sendOtp } from '../otp/otpService.js';

// Starting balance range, in agorot: ₪1,000.00 - ₪10,000.00 (requirement 3b).
const MIN_START_BALANCE = 100_000;
const MAX_START_BALANCE = 1_000_000;

// ---------------------------------------------------------------------------
// Errors used in more than one place. Messages match openapi.yaml.
// ---------------------------------------------------------------------------
const emailTaken = () =>
  new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
const invalidOtp = () => new AppError(400, 'INVALID_OTP', 'The code is incorrect.');
const alreadyVerified = () =>
  new AppError(409, 'ALREADY_VERIFIED', 'This account is already verified. Please log in.');
const sessionExpired = () =>
  new AppError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');

// ---------------------------------------------------------------------------
// Sign-up (requirement 1)
// ---------------------------------------------------------------------------
export async function signup({ email, password, phone, otpChannel }) {
  // A pending account whose code expired is dead (the TTL index will delete
  // it within ~60 s). Delete it now, so this email can sign up again at once.
  await userRepo.deleteExpiredPending(email);

  // Fast path: most duplicates are caught here, before spending ~250 ms on bcrypt.
  if (await userRepo.findByEmail(email)) {
    throw emailTaken();
  }

  const passwordHash = await hashPassword(password);
  const code = generateOtp();
  const otp = await newOtpRecord(code);

  // The REAL duplicate guarantee: the awaits above gave other requests a
  // chance to run, so a second sign-up with the same email may have been
  // inserted meanwhile. create() refuses it in one step.
  let user;
  try {
    user = await userRepo.create({
      email,
      passwordHash,
      phone,
      otpChannel,
      isVerified: false,
      balance: 0, // the real starting balance is set at verification
      otp,
    });
  } catch (err) {
    if (err instanceof DuplicateEmailError) throw emailTaken();
    throw err;
  }

  // Send AFTER saving: a code must never exist for an account that failed to save.
  await deliverOtp(user, code);

  return { email: user.email, otpChannel: user.otpChannel, otpExpiresAt: otp.expiresAt };
}

// ---------------------------------------------------------------------------
// OTP verification (requirement 2) - the order of the checks matters
// ---------------------------------------------------------------------------
export async function verifyOtp({ email, code }) {
  const user = await userRepo.findByEmail(email);

  // Unknown email gets the same answer as a wrong code, so this endpoint
  // can't be used to find out which emails have pending accounts.
  if (!user) throw invalidOtp();

  if (user.isVerified) throw alreadyVerified();

  // Checked BEFORE comparing the code - otherwise a 6th guess would still be tested.
  if (user.otp.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new AppError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts. Request a new code.');
  }

  // Checked before comparing too: an expired code is dead even if it's correct.
  if (user.otp.expiresAt <= new Date()) {
    throw new AppError(400, 'OTP_EXPIRED', 'The code has expired. Request a new one.');
  }

  if (!(await verifyOtpCode(code, user.otp.hash))) {
    // The counter must be SAVED, or the attempt limit would mean nothing.
    await userRepo.incrementOtpAttempts(user.id);
    throw invalidOtp();
  }

  // Correct code: verify + set the random starting balance in ONE conditional
  // step. Returns null if a simultaneous request already verified it.
  const startingBalance = randomInt(MIN_START_BALANCE, MAX_START_BALANCE + 1);
  const verified = await userRepo.markVerified(user.id, startingBalance);
  if (!verified) throw alreadyVerified();

  // Requirement 2b: go straight to the dashboard, so verifying also logs in.
  return issueTokens(verified);
}

// ---------------------------------------------------------------------------
// Resend OTP
// ---------------------------------------------------------------------------
export async function resendOtp({ email }) {
  const user = await userRepo.findByEmail(email);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'No account found for this email.');
  if (user.isVerified) throw alreadyVerified();

  // A new code with a new expiry and a fresh attempt counter. Replacing the
  // stored hash makes the old code stop working.
  const code = generateOtp();
  const otp = await newOtpRecord(code);
  await userRepo.update(user.id, { otp });
  await deliverOtp(user, code);

  return { email: user.email, otpChannel: user.otpChannel, otpExpiresAt: otp.expiresAt };
}

// ---------------------------------------------------------------------------
// Login (requirement 4)
// ---------------------------------------------------------------------------
export async function login({ email, password }) {
  const user = await userRepo.findByEmail(email);

  // Always run bcrypt, even for an unknown email (against DUMMY_HASH), so both
  // failures take the same time and the same message - nothing reveals
  // whether the email exists.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  // Only AFTER the password check: otherwise this 403 would tell anyone,
  // without the password, that the email has a pending account.
  if (!user.isVerified) {
    throw new AppError(403, 'ACCOUNT_NOT_VERIFIED', 'Please verify your account with the code we sent.');
  }

  return issueTokens(user);
}

// ---------------------------------------------------------------------------
// Refresh: trade a refresh token for a new access + refresh token pair
// ---------------------------------------------------------------------------
export async function refresh(refreshToken) {
  if (!refreshToken) throw sessionExpired();

  const record = await refreshTokenRepo.findByHash(hashRefreshToken(refreshToken));
  if (!record || record.expiresAt <= new Date()) throw sessionExpired();

  // Rotation: each refresh token works ONCE. revoke() returns false if it was
  // already revoked - meaning an old token is being reused. Either the user
  // or an attacker has a stolen copy, and we can't tell which, so we sign
  // out ALL of this user's sessions ("reuse detection").
  const revokedNow = await refreshTokenRepo.revoke(record.tokenHash);
  if (!revokedNow) {
    await refreshTokenRepo.revokeAllForUser(record.userId);
    throw sessionExpired();
  }

  const user = await userRepo.findById(record.userId);
  if (!user) throw sessionExpired();

  return issueTokens(user);
}

// ---------------------------------------------------------------------------
// Logout (requirement 3d)
// ---------------------------------------------------------------------------
export async function logout(refreshToken) {
  // Always succeeds: logging out with no token, or twice, is not an error.
  if (refreshToken) {
    await refreshTokenRepo.revoke(hashRefreshToken(refreshToken));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shared by verify, login and refresh: a new access token + refresh token. */
async function issueTokens(user) {
  const refreshToken = createRefreshToken();
  await refreshTokenRepo.create({
    tokenHash: hashRefreshToken(refreshToken), // only the hash is stored
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return {
    accessToken: signAccessToken(user.id),
    refreshToken, // the controller puts this in the cookie, never in the JSON body
    user: toPublicUser(user),
  };
}

async function newOtpRecord(code) {
  return {
    hash: await hashOtp(code),
    expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000),
    attempts: 0,
  };
}

async function deliverOtp(user, code) {
  try {
    await sendOtp({
      channel: user.otpChannel,
      to: user.otpChannel === 'email' ? user.email : user.phone,
      code,
    });
  } catch (err) {
    // Log the real reason for us; give the client a clear, safe message.
    // The user is saved, so they can use "resend code".
    console.error('[OTP] delivery failed:', err);
    throw new AppError(502, 'OTP_DELIVERY_FAILED', "We couldn't send the code. Please try again.");
  }
}
