// The route table: which URL shows which page, and who may see it.
import { Navigate, Route, Routes } from 'react-router';
import { GuestRoute, ProtectedRoute } from './auth/RouteGuards';
import AppLayout from './components/AppLayout';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transfer from './pages/Transfer';
import SignedOut from './pages/SignedOut';

export default function App() {
  return (
    <Routes>
      {/* Signed-out users only: a signed-in user is sent to /dashboard
          (or back to the page they came from, after logging in). */}
      <Route element={<GuestRoute />}>
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<VerifyOtp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signed-out" element={<SignedOut />} />
      </Route>

      {/* Signed-in users only: everyone else is sent to /login.
          AppLayout adds the top bar around both pages. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transfer" element={<Transfer />} />
        </Route>
      </Route>

      {/* "/" and any unknown URL go to the login page. `replace` swaps the
          history entry, so Back doesn't bounce the user to the bad URL again. */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
