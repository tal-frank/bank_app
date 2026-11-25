// Access tokens (JWT) and refresh tokens (random strings).
//
// ACCESS TOKEN - a JWT: header.payload.signature
//   - Sent with every protected request: Authorization: Bearer <token>
//   - The server trusts it by checking the signature with JWT_ACCESS_SECRET.
//     No database lookup needed - that's the point of a JWT.
//   - It is SIGNED, not ENCRYPTED: anyone can decode and read the payload,
//     so it holds only the user id (`sub`) and expiry (`exp`), nothing secret.
//   - It can't be cancelled once issued, so it's kept short-lived (15 min).
//
// REFRESH TOKEN - 32 random bytes, NOT a JWT
//   - Lives 7 days in an httpOnly cookie, used only to get new access tokens.
//   - The server must look it up anyway (to check it hasn't been revoked),
//     so a signature would add nothing. Random + stored = simple + revocable.
//   - Stored as a SHA-256 hash. A fast, unsalted hash is fine here because
//     256 random bits can't be guessed, and it lets us FIND the record by
//     hash. (bcrypt's random salt would make lookup impossible.)
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_TOKEN_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MINUTES * 60;
export const REFRESH_TOKEN_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// Pin the algorithm. Without this, verify() would accept whatever algorithm
// the token's header CLAIMS to use - a classic JWT attack.
const ALGORITHM = 'HS256';

export function signAccessToken(userId) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId, // becomes the standard `sub` claim: who the token is about
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    algorithm: ALGORITHM,
  });
}

/**
 * Returns the user id inside a valid token. Throws jwt.TokenExpiredError if
 * it expired, or another jwt error if it's invalid in any other way.
 */
export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALGORITHM] });
  return payload.sub;
}

export function createRefreshToken() {
  return randomBytes(32).toString('base64url'); // URL/cookie-safe characters
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
