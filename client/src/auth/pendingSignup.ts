// Remembers WHO is verifying between Register/Login and /verify.
// Router state alone is lost on reload, so we also keep it in sessionStorage
// (per tab, gone when the tab closes). Not in the URL (?email=): URLs end up
// in browser history and server logs.
import type { OtpChannel } from '../api/types';

export type PendingSignup = {
  email: string;
  otpChannel?: OtpChannel;
  // When the code - and with it the pending account - expires (ISO date).
  // Unknown when coming from Login ("Enter code").
  otpExpiresAt?: string;
};

const KEY = 'pendingSignup';

export function savePendingSignup(value: PendingSignup) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage can be blocked (private mode); router state still works until reload.
  }
}

export function loadPendingSignup(): PendingSignup | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingSignup) : null;
  } catch {
    return null;
  }
}

export function clearPendingSignup() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clean up
  }
}
