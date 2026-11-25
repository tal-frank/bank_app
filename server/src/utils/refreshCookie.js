// Setting and clearing the refresh-token cookie, in ONE place, so every
// endpoint uses exactly the same flags.
import { env } from '../config/env.js';
import { REFRESH_TOKEN_TTL_MS } from './tokens.js';

export const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = {
  // JavaScript on the page can't read it, so injected scripts (XSS) can't steal it.
  httpOnly: true,
  // HTTPS only in production. Locally we use plain http://localhost.
  secure: env.NODE_ENV === 'production',
  // Requests started by OTHER sites don't carry it - protects against CSRF.
  // Works locally because localhost:5173 and localhost:3000 are the same
  // "site". PHASE 6: frontend (Vercel) and API (Render) are different sites,
  // so this must become 'none' (which also requires secure: true).
  sameSite: 'strict',
  // Only sent to /api/auth/* - not attached to every other API request.
  path: '/api/auth',
};

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
}

export function clearRefreshCookie(res) {
  // A cookie is only removed if path (and the other flags) match how it was set.
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}
