// Holds "who is signed in" for the whole app and shares it through AuthContext.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { refreshAccessToken, setAccessToken, setSessionEndedHandler, setSessionUser } from '../api/client';
import { logout } from '../api/auth';
import { getMe } from '../api/users';
import type { AuthResponse, User } from '../api/types';
import { AuthContext, type AuthStatus, type AuthValue, type EndReason } from './authContext';

// BroadcastChannel: a browser API that sends messages between tabs of the SAME
// site (same origin). Used to keep every tab of this browser on the same user:
//   signed-out -> other tabs of THAT user leave too (instead of waiting up to
//                 15 min for their token to expire)
//   signed-in  -> tabs showing a DIFFERENT user leave: the shared refresh
//                 cookie now belongs to the new user, so they can't continue
// Each message names the user, so a tab only reacts to what concerns it.
const CHANNEL_NAME = 'bank-app-auth';
type AuthMessage =
  | { type: 'signed-in'; userId: string; email: string }
  | { type: 'signed-out'; userId: string };

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const [endReason, setEndReason] = useState<EndReason>(null);

  // The current status/user for callbacks that run outside a render (the
  // channel's onmessage, signOut), which would otherwise see stale values.
  const statusRef = useRef(status);
  const userRef = useRef(user);
  useEffect(() => {
    statusRef.current = status;
    userRef.current = user;
  }, [status, user]);

  // Forget the session locally (memory token + React state), remembering why.
  const clearSession = useCallback((reason: EndReason) => {
    setAccessToken(null);
    setSessionUser(null);
    setUserState(null);
    setEndReason(reason);
    setStatus('signedOut');
  }, []);

  // Startup: the access token was lost on reload, but the httpOnly refresh
  // cookie survived. Trade it for a new token, then load the user
  // (/auth/refresh returns only a token). No cookie -> 401 -> signed out.
  useEffect(() => {
    // StrictMode runs this effect twice in development (mount, unmount, mount).
    // Both runs call refreshAccessToken() while the first is still in flight,
    // so they share ONE request (see client.ts). `ignore` makes the first,
    // unmounted run skip its state updates.
    let ignore = false;
    (async () => {
      try {
        await refreshAccessToken();
        const me = await getMe();
        if (!ignore) {
          setSessionUser(me.id); // from now on, refreshes must return THIS user
          setUserState(me);
          setStatus('signedIn');
        }
      } catch {
        if (!ignore) clearSession(null); // simply not signed in: no message
      }
    })();
    return () => {
      ignore = true;
    };
  }, [clearSession]);

  // Let the axios interceptor end the session: refresh failed / token rejected
  // (expired), or a refresh returned another user's token (switched).
  useEffect(() => {
    setSessionEndedHandler((cause) =>
      clearSession(cause === 'switched' ? { kind: 'switched' } : { kind: 'expired' }),
    );
    return () => setSessionEndedHandler(null);
  }, [clearSession]);

  // Listen to the other tabs. A channel never receives its own messages.
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return; // very old browsers
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<AuthMessage>) => {
      const msg = event.data;
      const me = userRef.current;
      // Only a signed-in tab has a session to end.
      if (statusRef.current !== 'signedIn' || !me) return;

      if (msg.type === 'signed-out' && msg.userId === me.id) {
        // Same user logged out elsewhere: the server already revoked the cookie.
        clearSession({ kind: 'logout' });
      } else if (msg.type === 'signed-in' && msg.userId !== me.id) {
        // A different user took over this browser's cookie.
        clearSession({ kind: 'switched', email: msg.email });
      }
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [clearSession]);

  const post = (msg: AuthMessage) => channelRef.current?.postMessage(msg);

  const signIn = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken);
    setSessionUser(res.user.id);
    setUserState(res.user);
    setEndReason(null);
    setStatus('signedIn');
    post({ type: 'signed-in', userId: res.user.id, email: res.user.email });
  }, []);

  const signOut = useCallback(async () => {
    const userId = userRef.current?.id; // read before clearSession empties it
    try {
      await logout();
    } catch {
      // Even if the server is unreachable, sign out locally: the user asked to leave.
    } finally {
      clearSession({ kind: 'logout' }); // ProtectedRoute then shows /signed-out
      if (userId) post({ type: 'signed-out', userId }); // ...and this user's other tabs too
    }
  }, [clearSession]);

  const clearEndReason = useCallback(() => setEndReason(null), []);

  // useMemo: a new object every render would re-render every useAuth() user.
  const value = useMemo<AuthValue>(
    () => ({ status, user, endReason, signIn, signOut, setUser: setUserState, clearEndReason }),
    [status, user, endReason, signIn, signOut, clearEndReason],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
