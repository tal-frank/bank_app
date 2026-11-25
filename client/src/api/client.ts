// The ONE axios instance every request goes through. Things that must happen on
// every request (base URL, cookies, the Bearer header, refreshing an expired
// token) live here, so no page has to remember them.
import axios, { AxiosError } from 'axios';
import { config } from '../config';
import type { ApiErrorBody, RefreshResponse } from './types';

// Let TypeScript know about our own flag on a request's config (see below).
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retried?: boolean;
  }
}

export const api = axios.create({
  baseURL: config.apiUrl, // pages write '/auth/login', not the full URL
  // Send cookies to the API's origin. Without this the browser drops the
  // httpOnly refresh cookie and /auth/refresh never sees it.
  withCredentials: true,
});

// ---- The access token: kept in a plain module variable -----------------------
// Not localStorage (any script on the page could read it, e.g. after an XSS bug),
// and not React state (the interceptors below run outside React).
// Cost: it's lost on page reload - AuthProvider gets a new one from the cookie.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// ---- Refresh: only ONE request in flight at a time ----------------------------
// The server rotates the refresh token on every use and treats a second use of
// the old one as theft (it signs out every session). If 3 requests expire at
// once and each called /auth/refresh, requests 2 and 3 would send the
// already-used cookie -> signed out. So we keep the promise of the refresh that
// is running and let every caller wait on that same promise.
//
// That promise only works INSIDE one tab. Other tabs share the same cookie but
// not our variables, so two tabs refreshing at once would also send the same
// cookie twice. See withCrossTabLock() below for that half.
let refreshInFlight: Promise<string> | null = null;

const REFRESH_LOCK = 'bank-app-refresh';
const REFRESH_TIMEOUT_MS = 10_000;

/**
 * Run `task` while holding a lock shared by every tab of this site (Web Locks
 * API). Tabs take turns: tab B waits until tab A's refresh has finished, and by
 * then the browser has stored the NEW cookie, so B sends that one instead of
 * the already-used one.
 * No navigator.locks (very old browser, or a page that isn't https/localhost):
 * just run the task, same as before.
 */
function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return task();
  // The lock is released when `task`'s promise settles (success OR failure).
  return navigator.locks.request(REFRESH_LOCK, task);
}

// ---- Whose session is this tab showing? -------------------------------------
// All tabs share ONE refresh cookie, and it belongs to whoever logged in LAST.
// If another tab logged in as a different user, our next refresh would hand
// us THAT user's token while the screen still shows ours - a transfer would
// then move the other person's money. So after every refresh we check that the
// new token is for the user on screen.
let sessionUserId: string | null = null;

/** AuthProvider sets this on sign-in / startup, and null on sign-out. */
export function setSessionUser(userId: string | null) {
  sessionUserId = userId;
}

/** Thrown when a refresh returned a token for a different user. */
export class SessionUserChangedError extends Error {
  constructor() {
    super('The refresh cookie now belongs to a different user.');
  }
}

/**
 * Read the user id (`sub`) from a JWT WITHOUT verifying it. That's fine here:
 * we only COMPARE it to decide whether to throw the token away. The server
 * verifies the signature on every request; we never trust this for access.
 * A JWT is header.payload.signature, each part base64url-encoded JSON.
 */
function userIdFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = withCrossTabLock(() =>
      axios
        // Plain axios, not `api`: a failing refresh must not go through the
        // interceptor below and try to refresh itself.
        // timeout: a hung request would otherwise hold the lock and block
        // every other tab's refresh.
        .post<RefreshResponse>(`${config.apiUrl}/auth/refresh`, null, {
          withCredentials: true,
          timeout: REFRESH_TIMEOUT_MS,
        })
        .then((res) => res.data.accessToken),
    )
      .then((token) => {
        // Someone else's token: don't keep it (see sessionUserId above).
        // At startup sessionUserId is null - any user is fine then.
        if (sessionUserId && userIdFromToken(token) !== sessionUserId) {
          throw new SessionUserChangedError();
        }
        accessToken = token;
        return token;
      })
      .finally(() => {
        refreshInFlight = null; // the next expiry (15 min later) starts a new one
      });
  }
  return refreshInFlight;
}

// ---- "Session is over" callback ----------------------------------------------
// The interceptor can't touch React state, so AuthProvider registers a function
// here. Called with WHY the session ended:
//   expired  - the refresh failed (refresh token expired/revoked) or the
//              server rejected our token
//   switched - the refresh worked, but for a different user (another tab)
export type SessionEndCause = 'expired' | 'switched';
let onSessionEnded: ((cause: SessionEndCause) => void) | null = null;

export function setSessionEndedHandler(handler: ((cause: SessionEndCause) => void) | null) {
  onSessionEnded = handler;
}

// ---- Request interceptor: attach the token -----------------------------------
api.interceptors.request.use((req) => {
  if (accessToken) req.headers.Authorization = `Bearer ${accessToken}`;
  return req;
});

// ---- Response interceptor: refresh on TOKEN_EXPIRED, retry once --------------
api.interceptors.response.use(
  (res) => res, // success: pass through untouched
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config;
    const code = error.response?.status === 401 ? error.response.data?.error?.code : undefined;
    const expired = code === 'TOKEN_EXPIRED';

    // UNAUTHORIZED on a request that CARRIED our token = the server no longer
    // accepts it (e.g. its JWT secret changed). Refreshing won't fix that;
    // end the session so the user isn't left on a page where every call fails.
    // (Without a token - e.g. login/logout - a 401 is a normal answer.)
    if (code === 'UNAUTHORIZED' && original?.headers.Authorization) {
      accessToken = null;
      onSessionEnded?.('expired');
      throw error;
    }

    // Only an expired token is worth a refresh. UNAUTHORIZED (no/bad token),
    // INVALID_CREDENTIALS etc. go straight back to the caller.
    // `_retried` stops an endless loop if the retry fails again.
    if (!expired || !original || original._retried) throw error;
    original._retried = true;

    try {
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original); // the caller gets this result as if nothing happened
    } catch (refreshError) {
      // Refresh failed (or gave another user's token): this tab's session is
      // over. Clear it; ProtectedRoute will then send the user to /login.
      accessToken = null;
      onSessionEnded?.(refreshError instanceof SessionUserChangedError ? 'switched' : 'expired');
      throw error;
    }
  },
);
