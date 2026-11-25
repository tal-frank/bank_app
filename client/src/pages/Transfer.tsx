// Send money (wireframe: Transfer.dc.html). POST /transactions, then back to
// the dashboard with a success message and the new balance.
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import SubmitButton from '../components/SubmitButton';
import { createTransfer } from '../api/transactions';
import { applyFieldErrors, getApiError, severityFor, type ApiError } from '../api/errors';
import { useAuth } from '../auth/authContext';
import { formatAgorot } from '../utils/money';
import { transferSchema, type TransferInput, type TransferValues } from '../validation/transfer';

const FIELDS = ['toEmail', 'amount'] as const;

// Same text as the server (services), so the user sees the same words
// whichever side catches the problem.
const MSG_SELF = "You can't send money to yourself.";
const MSG_TOO_LOW = 'Your balance is too low for this transfer.';

export default function Transfer() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [formError, setFormError] = useState<ApiError | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TransferInput, unknown, TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { toEmail: '', amount: '' },
  });

  // ProtectedRoute guarantees a signed-in user; this keeps TypeScript sure too.
  if (!user) return null;

  // `amount` here is already integer agorot (zod converted the ₪ text).
  const onSubmit = async ({ toEmail, amount }: TransferValues) => {
    setFormError(null);

    // Instant checks with what we already know. The server checks again
    // (the balance may have changed since this page loaded).
    if (toEmail === user.email) return setError('toEmail', { type: 'client', message: MSG_SELF });
    if (amount > user.balance) return setError('amount', { type: 'client', message: MSG_TOO_LOW });

    try {
      // While this awaits, isSubmitting is true -> Send is disabled, so a
      // double click can't send the money twice.
      const res = await createTransfer(toEmail, amount);
      // The reply carries the new balance: update it app-wide, no extra request.
      setUser({ ...user, balance: res.balance });
      navigate('/dashboard', {
        state: {
          notice: `Sent ${formatAgorot(amount)} to ${toEmail}. New balance: ${formatAgorot(res.balance)}`,
        },
      });
    } catch (err) {
      const e = getApiError(err);
      switch (e.code) {
        case 'RECIPIENT_NOT_FOUND':
        case 'SELF_TRANSFER':
          setError('toEmail', { type: 'server', message: e.message });
          return;
        case 'INSUFFICIENT_FUNDS':
          setError('amount', { type: 'server', message: e.message });
          return;
        case 'VALIDATION_ERROR':
          if (applyFieldErrors(e, setError, FIELDS)) return;
          break;
      }
      setFormError(e);
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 560, mx: 'auto' }}>
      <Link component={RouterLink} to="/dashboard" underline="hover">
        ← Back to dashboard
      </Link>

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Send money
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Available: <strong>{formatAgorot(user.balance)}</strong>
        </Typography>

        <Stack component="form" spacing={2.5} noValidate onSubmit={handleSubmit(onSubmit)}>
          {formError && <Alert severity={severityFor(formError.code)}>{formError.message}</Alert>}

          <TextField
            label="Recipient email"
            type="email"
            autoComplete="off" // not the user's own email; don't let the browser suggest it
            autoFocus
            {...register('toEmail')}
            error={!!errors.toEmail}
            helperText={errors.toEmail?.message}
          />
          <TextField
            label="Amount"
            // Text, not type="number": number inputs change the value on
            // scroll, accept "1e5", and hide what the user really typed.
            // inputMode="decimal" still opens the number keypad on phones.
            inputMode="decimal"
            autoComplete="off"
            placeholder="25.00"
            slotProps={{ input: { startAdornment: <InputAdornment position="start">₪</InputAdornment> } }}
            {...register('amount')}
            error={!!errors.amount}
            helperText={errors.amount?.message ?? 'Up to 2 decimals.'}
          />

          <Stack direction="row" spacing={2}>
            <SubmitButton loading={isSubmitting} loadingText="Sending…">
              Send
            </SubmitButton>
            <Button
              component={RouterLink}
              to="/dashboard"
              size="large"
              fullWidth
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
