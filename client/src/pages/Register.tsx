// Register (wireframe: Main.dc.html). POST /auth/signup, then go to /verify.
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  FormLabel,
  Link,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import PageShell from '../components/PageShell';
import SubmitButton from '../components/SubmitButton';
import { signup } from '../api/auth';
import { applyFieldErrors, getApiError, severityFor, type ApiError } from '../api/errors';
import { savePendingSignup } from '../auth/pendingSignup';
import { signupSchema, type SignupInput, type SignupValues } from '../validation/auth';

const FIELDS = ['email', 'password', 'phone', 'otpChannel'] as const;

export default function Register() {
  const navigate = useNavigate();
  // A server error that isn't about one field (shown as an alert above the form).
  const [formError, setFormError] = useState<ApiError | null>(null);

  // useForm<what the inputs hold, context, what onSubmit receives after zod>.
  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput, unknown, SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', phone: '', otpChannel: 'email' },
  });

  // Runs only if the client-side rules pass. While this promise runs,
  // isSubmitting is true, which disables the button.
  const onSubmit = async (values: SignupValues) => {
    setFormError(null);
    try {
      const res = await signup(values);
      const pending = { email: res.email, otpChannel: res.otpChannel, otpExpiresAt: res.otpExpiresAt };
      savePendingSignup(pending);
      navigate('/verify', { state: pending });
    } catch (err) {
      const e = getApiError(err);
      if (e.code === 'VALIDATION_ERROR' && applyFieldErrors(e, setError, FIELDS)) return;
      if (e.code === 'OTP_DELIVERY_FAILED') {
        // The account WAS saved; only the code didn't go out. Continue to
        // /verify, which shows this error next to "Send a new code".
        const pending = { email: values.email, otpChannel: values.otpChannel };
        savePendingSignup(pending);
        navigate('/verify', { state: { ...pending, deliveryFailed: true } });
        return;
      }
      setFormError(e);
    }
  };

  return (
    <PageShell
      title="Create your account"
      subtitle="Step 1 of 2. We'll send a 6-digit code to verify it's you."
    >
      {/* noValidate: let zod show our messages instead of the browser's popups. */}
      <Stack component="form" spacing={2.5} noValidate onSubmit={handleSubmit(onSubmit)}>
        {formError && (
          <Alert severity={severityFor(formError.code)}>
            {formError.message}
            {formError.code === 'EMAIL_TAKEN' && (
              <>
                {' '}
                <Link component={RouterLink} to="/login" state={{ email: getValues('email') }}>
                  Log in
                </Link>
              </>
            )}
          </Alert>
        )}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          {...register('email')}
          error={!!errors.email}
          helperText={errors.email?.message}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password" // lets password managers offer a strong one
          {...register('password')}
          error={!!errors.password}
          helperText={errors.password?.message ?? '8–72 characters, at least one letter and one digit.'}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          placeholder="+972501234567"
          {...register('phone')}
          error={!!errors.phone}
          helperText={errors.phone?.message ?? 'International format, no spaces.'}
        />

        {/* ToggleButtonGroup isn't a native input, so it can't use register();
            Controller connects its value/onChange to the form instead. */}
        <Stack spacing={1}>
          <FormLabel id="otp-channel-label">Send my code by</FormLabel>
          <Controller
            name="otpChannel"
            control={control}
            render={({ field }) => (
              <ToggleButtonGroup
                aria-labelledby="otp-channel-label"
                exclusive
                fullWidth
                color="primary"
                value={field.value}
                // MUI passes null when the selected button is clicked again;
                // ignore that so one channel is always chosen.
                onChange={(_, value) => value && field.onChange(value)}
              >
                <ToggleButton value="email">Email</ToggleButton>
                <ToggleButton value="sms">SMS</ToggleButton>
              </ToggleButtonGroup>
            )}
          />
        </Stack>

        <SubmitButton loading={isSubmitting}>Create account</SubmitButton>

        <Typography variant="body2" align="center">
          Already have an account?{' '}
          <Link component={RouterLink} to="/login">
            Log in
          </Link>
        </Typography>
      </Stack>
    </PageShell>
  );
}
