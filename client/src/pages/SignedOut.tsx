// Signed out (wireframe: SignedOut.dc.html). Shown after Log out, in this tab
// or (via BroadcastChannel) in another one. No API call: logout already ran.
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router';
import { Button, Typography } from '@mui/material';
import PageShell from '../components/PageShell';
import { useAuth } from '../auth/authContext';

export default function SignedOut() {
  const { clearEndReason } = useAuth();

  // The reason did its job (it brought us here). Forget it, so pressing Back
  // to /dashboard goes to /login instead of showing this page again.
  useEffect(() => {
    clearEndReason();
  }, [clearEndReason]);

  return (
    <PageShell title="You're signed out">
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Your session on this device has ended.
      </Typography>
      <Button variant="contained" size="large" fullWidth component={RouterLink} to="/login">
        Log in again
      </Button>
    </PageShell>
  );
}
