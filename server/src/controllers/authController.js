// The HTTP side of auth. Each controller is deliberately thin:
//   1. read the already-validated input (req.validated.body) or the cookie
//   2. call the service, which holds all the rules
//   3. set/clear the cookie and send the response shape from openapi.yaml
// No business rules here - if you find an `if` about users or codes in this
// file, it probably belongs in services/authService.js.
//
// Errors thrown by the service go straight to the error handler middleware
// (Express 5 catches errors from async functions), so there's no try/catch.
import * as authService from '../services/authService.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../utils/tokens.js';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from '../utils/refreshCookie.js';

// The spec's AuthResponse. The refresh token is NOT in it - only in the cookie.
function sendAuthResponse(res, { accessToken, refreshToken, user }) {
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS, user });
}

// POST /api/auth/signup -> 201 SignupResponse
export async function signup(req, res) {
  const result = await authService.signup(req.validated.body);
  res.status(201).json(result);
}

// POST /api/auth/verify-otp -> 200 AuthResponse + cookie
export async function verifyOtp(req, res) {
  sendAuthResponse(res, await authService.verifyOtp(req.validated.body));
}

// POST /api/auth/resend-otp -> 200 SignupResponse
export async function resendOtp(req, res) {
  res.json(await authService.resendOtp(req.validated.body));
}

// POST /api/auth/login -> 200 AuthResponse + cookie
export async function login(req, res) {
  sendAuthResponse(res, await authService.login(req.validated.body));
}

// POST /api/auth/refresh -> 200 RefreshResponse + new cookie
export async function refresh(req, res) {
  try {
    const { accessToken, refreshToken } = await authService.refresh(req.cookies[REFRESH_COOKIE]);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  } catch (err) {
    // The cookie is useless now - remove it from the browser, then let the
    // error handler send the 401.
    clearRefreshCookie(res);
    throw err;
  }
}

// POST /api/auth/logout -> 204
export async function logout(req, res) {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).end();
}
