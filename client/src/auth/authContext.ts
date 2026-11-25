// The auth "channel": the shape of what AuthProvider shares, and the useAuth()
// hook pages use to read it. Kept apart from AuthProvider.tsx because Vite's
// fast refresh only hot-reloads files that export components and nothing else.
import { createContext, useContext } from 'react';
import type { AuthResponse, User } from '../api/types';

/** loading = startup refresh still running; we don't know yet. */
export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

/**
 * WHY the last session ended, so ProtectedRoute (the one place that redirects
 * signed-out users) can pick the right page:
 *   logout   -> /signed-out (this tab, or another tab of the SAME user, logged out)
 *   expired  -> /login with "Session expired. Please log in again."
 *   switched -> /login with "You signed in as <email> in another tab."
 *               (one browser = one refresh cookie = one user at a time)
 *   null     -> /login (never signed in, or the reason was already used)
 */
export type EndReason =
  | { kind: 'logout' }
  | { kind: 'expired' }
  | { kind: 'switched'; email?: string } // email unknown if found via a refresh
  | null;

export type AuthValue = {
  status: AuthStatus;
  user: User | null;
  endReason: EndReason;
  /** Call with the response of login / verify-otp. */
  signIn: (res: AuthResponse) => void;
  /** Revokes the session on the server, forgets it here, and tells other tabs. */
  signOut: () => Promise<void>;
  /** Replace the stored user, e.g. with the new balance after a transfer. */
  setUser: (user: User) => void;
  /** Forget endReason once its page was shown (so Back doesn't show it again). */
  clearEndReason: () => void;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  // A clear error beats "cannot read properties of null" deep in a page.
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>');
  return value;
}
