// Verify code (wireframe: Otp.dc.html). POST /auth/verify-otp signs the user
// in (same response as login), so success goes straight to the dashboard.
// (The /register and /login redirects below happen while still signed out,
// so GuestRoute doesn't interfere with them.)
//
// A pending account lives only as long as its code: when the code expires,
// the server deletes the account. So once expired, this page can only send
// the user back to Register.
import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Link, Stack, TextField, Typography, type AlertColor } from '@mui/material';
import PageShell from '../components/PageShell';
import SubmitButton from '../components/SubmitButton';
import { resendOtp, verifyOtp } from '../api/auth';
import { getApiError, severityFor } from '../api/errors';
import { useAuth } from '../auth/authContext';
import {
  clearPendingSignup,
  loadPendingSignup,
  savePendingSignup,
  type PendingSignup,
} from '../auth/pendingSignup';
import { verifyOtpSchema, type VerifyOtpInput, type VerifyOtpValues } from '../validation/auth';

// Matches the server's resend limit (1 per minute per email).
const RESEND_COOLDOWN_SECONDS = 60;

type LocationState = (PendingSignup & { deliveryFailed?: boolean }) | null;
type Notice = { severity: AlertColor; message: string };

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  // Router state first (fresh from Register/Login), sessionStorage after a reload.
  const state = location.state as LocationState;
  // Read ONCE when the page opens (useState initializer), not on every render:
  // goToLogin/onSubmit clear the storage and then navigate, and React may
  // render this page once more in between. Re-reading would find nothing and
  // the <Navigate to="/register"> below would beat our navigation.
  const [pending] = useState(() => (state?.email ? state : loadPendingSignup()));

  const [notice, setNotice] = useState<Notice | null>(
    state?.deliveryFailed
      ? { severity: 'error', message: "We couldn't send the code. Please try again." }
      : null,
  );
  // After OTP_ATTEMPTS_EXCEEDED the old code is dead: block Verify until a new one is sent.
  const [locked, setLocked] = useState(false);
  // Make "Send a new code" stand out when it's the only way forward.
  const [needNewCode, setNeedNewCode] = useState(!!state?.deliveryFailed);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // When the current code expires (each resend moves it), and whether it has.
  const [expiresAt, setExpiresAt] = useState(pending?.otpExpiresAt);
  const [expired, setExpired] = useState(
    () => !!pending?.otpExpiresAt && Date.parse(pending.otpExpiresAt) <= Date.now(),
  );

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpInput, unknown, VerifyOtpValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { code: '' },
  });

  // Count the resend cooldown down once a second. The cleanup clears the
  // timer, so it never runs after the page is gone.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // One timer that fires when the code expires. A new expiresAt (after a
  // resend) runs the cleanup, which cancels the old timer.
  useEffect(() => {
    if (!expiresAt) return;
    const ms = Date.parse(expiresAt) - Date.now();
    if (ms <= 0) return; // already handled by the initial state
    const id = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(id);
  }, [expiresAt]);

  // Nobody to verify (opened /verify directly): back to the start.
  // (After all hooks: React needs the same hooks in the same order every render.)
  if (!pending) return <Navigate to="/register" replace />;
  const { email, otpChannel } = pending;

  const goToLogin = (message: string) => {
    clearPendingSignup();
    navigate('/login', { replace: true, state: { email, info: message } });
  };

  // The account is gone (or about to be): the only way forward is Register.
  const markExpired = () => {
    clearPendingSignup();
    setExpired(true);
  };

  const onSubmit = async ({ code }: VerifyOtpValues) => {
    setNotice(null);
    try {
      const res = await verifyOtp(email, code);
      clearPendingSignup();
      signIn(res); // GuestRoute then redirects to /dashboard (see RouteGuards.tsx)
    } catch (err) {
      const e = getApiError(err);
      switch (e.code) {
        case 'INVALID_OTP':
        case 'VALIDATION_ERROR':
          // Under the field, and clear it so the next try starts fresh.
          setValue('code', '');
          setError('code', { type: 'server', message: e.fields?.code ?? e.message });
          setFocus('code');
          return;
        case 'OTP_EXPIRED':
          // Expired code = the server deletes the account within a minute.
          markExpired();
          return;
        case 'OTP_ATTEMPTS_EXCEEDED':
          setValue('code', '');
          setLocked(true);
          setNeedNewCode(true);
          break;
        case 'ALREADY_VERIFIED':
          goToLogin(e.message);
          return;
      }
      setNotice({ severity: severityFor(e.code), message: e.message });
    }
  };

  const onResend = async () => {
    setNotice(null);
    setResending(true);
    try {
      const res = await resendOtp(email);
      // The new code gives the account another 5 minutes: remember the new expiry.
      savePendingSignup({ email, otpChannel: res.otpChannel, otpExpiresAt: res.otpExpiresAt });
      setExpiresAt(res.otpExpiresAt);
      setLocked(false);
      setNeedNewCode(false);
      setValue('code', '');
      setNotice({ severity: 'success', message: 'We sent you a new code.' });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const e = getApiError(err);
      if (e.code === 'ALREADY_VERIFIED') return goToLogin(e.message);
      // No account any more = it expired and the server deleted it.
      if (e.code === 'USER_NOT_FOUND') return markExpired();
      // RATE_LIMITED also starts the countdown, so the user knows when to retry.
      if (e.code === 'RATE_LIMITED') setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice({ severity: severityFor(e.code), message: e.message });
    } finally {
      setResending(false);
    }
  };

  if (expired) {
    return (
      <PageShell title="Your sign-up expired">
        <Stack spacing={2.5}>
          <Alert severity="warning">
            The code wasn't entered within 5 minutes, so this sign-up was cancelled. Please register again.
          </Alert>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/register"
            onClick={clearPendingSignup}
          >
            Register again
          </Button>
        </Stack>
      </PageShell>
    );
  }

  const sentTo = otpChannel === 'sms' ? 'by SMS to your phone' : `to ${email}`;

  return (
    <PageShell
      title="Enter your code"
      subtitle={`Step 2 of 2. We sent a 6-digit code ${sentTo}. It expires in 5 minutes.`}
    >
      <Stack component="form" spacing={2.5} noValidate onSubmit={handleSubmit(onSubmit)}>
        {notice && <Alert severity={notice.severity}>{notice.message}</Alert>}

        <TextField
          label="6-digit code"
          autoFocus
          // numeric keypad on phones; browsers can autofill the code from an SMS
          inputMode="numeric"
          autoComplete="one-time-code"
          slotProps={{ htmlInput: { maxLength: 6 } }}
          {...register('code')}
          error={!!errors.code}
          helperText={errors.code?.message ?? 'You have 5 tries.'}
        />

        <SubmitButton loading={isSubmitting} disabled={locked}>
          Verify
        </SubmitButton>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2">Didn't get it?</Typography>
          <Button
            size="small"
            variant={needNewCode ? 'contained' : 'text'}
            onClick={onResend}
            disabled={resending || cooldown > 0}
          >
            {cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
          </Button>
        </Stack>

        <Typography variant="body2" align="center">
          <Link component={RouterLink} to="/register" onClick={clearPendingSignup}>
            Back to sign up
          </Link>
        </Typography>
      </Stack>
    </PageShell>
  );
}
