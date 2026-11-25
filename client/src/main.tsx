// Entry point: Vite loads this file from index.html and mounts React into <div id="root">.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import AuthProvider from './auth/AuthProvider';
import App from './App';

createRoot(document.getElementById('root')!).render(
  // StrictMode runs extra checks in development only (e.g. renders twice to
  // expose side effects in render). It adds nothing to the production build.
  <StrictMode>
    {/* ThemeProvider: every MUI component below reads colors/shapes from our theme. */}
    <ThemeProvider theme={theme}>
      {/* CssBaseline: resets browser default styles so every browser starts the same. */}
      <CssBaseline />
      {/* BrowserRouter: keeps the URL in sync with which page is shown,
          using normal paths (/login) and the browser's back/forward buttons. */}
      <BrowserRouter>
        {/* AuthProvider: shares "who is signed in" with every page (useAuth()). */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
