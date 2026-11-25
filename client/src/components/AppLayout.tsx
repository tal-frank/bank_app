// Frame for the signed-in pages: top bar (brand, email, Log out) + page content.
// Used as a layout route in App.tsx, so the bar is written once and stays on
// screen while the page below it changes (<Outlet /> = the current page).
import { useState } from 'react';
import { Outlet, Link as RouterLink } from 'react-router';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { useAuth } from '../auth/authContext';

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // No navigate() here: signOut() records endReason 'logout', and
  // ProtectedRoute redirects to /signed-out (see RouteGuards.tsx for why).
  // This component unmounts during that redirect, so there's no
  // setSigningOut(false) afterwards.
  const onLogout = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography
            component={RouterLink}
            to="/dashboard"
            variant="h6"
            color="primary"
            sx={{ flexGrow: 1, fontWeight: 600, textDecoration: 'none' }}
          >
            Bank App
          </Typography>
          {/* Hide the email on narrow phones so the bar doesn't overflow. */}
          <Typography color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {user?.email}
          </Typography>
          <Button variant="outlined" onClick={onLogout} disabled={signingOut}>
            {signingOut ? 'Logging out…' : 'Log out'}
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
