// One MUI theme for the whole app: colors, fonts and component defaults live
// here, so pages never hard-code a color. Change a value here and every screen
// that uses it updates.
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1e5bb8' }, // buttons, links, focused inputs
    background: { default: '#f5f6f8' }, // page background behind the cards
  },
  shape: { borderRadius: 8 },
  components: {
    // Buttons keep normal capitalisation ("Log in", not "LOG IN").
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: 'none' } } },
  },
});
