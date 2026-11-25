// Protects a route: only requests with a valid access token get through.
// Usage (this afternoon):
//
//   router.get('/users/me', auth, getMe);
//
// On success it sets req.user = { id }, so controllers know WHO is calling
// without ever trusting a user id sent in the URL or body.
//
// It checks only the JWT's signature and expiry - no database lookup. That's
// what makes JWT auth fast and keeps the server stateless.
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/tokens.js';

export function auth(req, res, next) {
  // Expected header:  Authorization: Bearer eyJhbGciOi...
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please log in.');
  }

  let userId;
  try {
    userId = verifyAccessToken(token);
  } catch (err) {
    // A separate code for "expired" tells the frontend to call /auth/refresh
    // silently, instead of sending the user back to the login page.
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired.');
    }
    throw new AppError(401, 'UNAUTHORIZED', 'Please log in.');
  }

  req.user = { id: userId };
  next();
}
