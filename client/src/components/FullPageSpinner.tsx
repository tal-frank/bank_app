// Shown while the startup refresh decides whether someone is signed in, so the
// app doesn't flash the login page for a user who is actually signed in.
import { Box, CircularProgress } from '@mui/material';

export default function FullPageSpinner() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}
