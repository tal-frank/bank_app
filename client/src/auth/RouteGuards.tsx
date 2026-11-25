// Route guards: "layout routes" that render either their child page (<Outlet />)
// or a redirect. Wrapping routes in App.tsx keeps the rule in one place instead
// of an if-check at the top of every page.
import { Navigate, Outlet, useLocation } from 'react-router';
import FullPageSpinner from '../components/FullPageSpinner';
import { useAuth } from './authContext';

// The server's own text for an ended session (Errors.dc.html: UNAUTHORIZED).
const SESSION_EXPIRED = 'Session expired. Please log in again.';

/**
 * Pages for signed-in users only (/dashboard, /transfer).
 * Also THE place that moves a user out when their session ends: signOut() and
 * the interceptor only clear the session and record WHY (endReason). If a page
 * called navigate('/signed-out') itself, this guard would re-render first and
 * win with /login - the same race as GuestRoute below.
 */
export function ProtectedRoute() {
  const { status, endReason } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedOut') {
    if (endReason?.kind === 'logout') return <Navigate to="/signed-out" replace />;
    // Remember where they were, so logging in sends them back there.
    const from = location.pathname + location.search;
    let info: string | undefined;
    if (endReason?.kind === 'expired') info = SESSION_EXPIRED;
    if (endReason?.kind === 'switched') {
      info = endReason.email
        ? `You signed in as ${endReason.email} in another tab.`
        : 'You signed in with another account in a different tab.';
    }
    return <Navigate to="/login" replace state={{ from, info }} />;
  }
  return <Outlet />;
}

/**
 * Pages for signed-out users only (/login, /register, /verify).
 * This is also THE place that moves a user into the app after signing in:
 * Login/Verify only call signIn(), and the next render lands here with
 * status 'signedIn'. (If the pages also called navigate(), the two redirects
 * would race: React re-renders on signIn() before the router applies
 * navigate(), so this guard would win anyway.)
 */
export function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedIn') {
    // Back to the page ProtectedRoute sent them away from, else the dashboard.
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/dashboard'} replace />;
  }
  return <Outlet />;
}
