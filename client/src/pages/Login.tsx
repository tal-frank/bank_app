// Log in (wireframe: Login.dc.html). POST /auth/login; GuestRoute then sends
// the user back to the page they wanted (saved by ProtectedRoute) or the dashboard.
import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material';
import PageShell from '../components/PageShell';
import SubmitButton from '../components/SubmitButton';
import { login } from '../api/auth';
import { applyFieldErrors, getApiError, severityFor, type ApiError } from '../api/errors';
import { useAuth } from '../auth/authContext';
import { savePendingSignup } from '../auth/pendingSignup';
import { loginSchema, type LoginInput, type LoginValues } from '../validation/auth';

// What other pages may pass here in router state.
type LocationState = {
  from?: string; // set by ProtectedRoute
  email?: string; // prefill (from Register's "Log in" link or Verify)
  info?: string; // a message to show, e.g. ALREADY_VERIFIED from Verify
} | null;

const FIELDS = ['email', 'password'] as const;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const { signIn, clearEndReason } = useAuth();
  const [formError, setFormError] = useState<ApiError | null>(null);

  // An "expired" reason brought us here (the message is in router state now).
  // Forget it, so it can't affect a later redirect.
  useEffect(() => {
    clearEndReason();
  }, [clearEndReason]);

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state?.email ?? '', password: '' },
  });

  const onSubmit = async ({ email, password }: LoginValues) => {
    setFormError(null);
    try {
      const res = await login(email, password);
      // That's all: GuestRoute sees the signed-in user and redirects to
      // `from` or /dashboard (see RouteGuards.tsx for why not navigate() here).
      signIn(res);
    } catch (err) {
      const e = getApiError(err);
      if (e.code === 'VALIDATION_ERROR' && applyFieldErrors(e, setError, FIELDS)) return;
      setFormError(e);
    }
  };

  // ACCOUNT_NOT_VERIFIED: the code may have expired by now; /verify has "Send a new code".
  const goToVerify = () => {
    const pending = { email: getValues('email').trim().toLowerCase() };
    savePendingSignup(pending);
    navigate('/verify', { state: pending });
  };

  return (
    <PageShell title="Log in">
      <Stack component="form" spacing={2.5} noValidate onSubmit={handleSubmit(onSubmit)}>
        {/* Only show the incoming message until the user tries something. */}
        {state?.info && !formError && <Alert severity="info">{state.info}</Alert>}

        {formError && (
          <Alert
            severity={severityFor(formError.code)}
            action={
              formError.code === 'ACCOUNT_NOT_VERIFIED' ? (
                <Button color="inherit" size="small" onClick={goToVerify} sx={{ whiteSpace: 'nowrap' }}>
                  Enter code
                </Button>
              ) : undefined
            }
          >
            {formError.message}
          </Alert>
        )}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus={!state?.email}
          {...register('email')}
          error={!!errors.email}
          helperText={errors.email?.message}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          autoFocus={!!state?.email}
          {...register('password')}
          error={!!errors.password}
          helperText={errors.password?.message}
        />

        <SubmitButton loading={isSubmitting}>Log in</SubmitButton>

        <Typography variant="body2" align="center">
          New here?{' '}
          <Link component={RouterLink} to="/register">
            Create an account
          </Link>
        </Typography>
      </Stack>
    </PageShell>
  );
}
