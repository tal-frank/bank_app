// Turns ANY failed request into one predictable shape, so pages only ever
// switch on `code`. The server's `message` is written to be shown as is.
import { isAxiosError } from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { AlertColor } from '@mui/material';
import type { ApiErrorBody, ErrorCode } from './types';

export type ApiError = {
  /** NETWORK_ERROR is ours: there was no response at all (server down, offline, CORS). */
  code: ErrorCode | 'NETWORK_ERROR';
  message: string;
  fields?: Record<string, string>;
};

export function getApiError(err: unknown): ApiError {
  if (isAxiosError<ApiErrorBody>(err)) {
    const body = err.response?.data?.error;
    if (body?.code) return body; // the normal case: our server's error shape
    if (!err.response) {
      return { code: 'NETWORK_ERROR', message: "Can't reach the server. Check your connection and try again." };
    }
  }
  // A response without our shape (e.g. a proxy's HTML page) or a bug in our code.
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };
}

/**
 * VALIDATION_ERROR: put each server message under its input.
 * Returns true if at least one field matched a form input.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  formFields: readonly Path<T>[],
): boolean {
  let applied = false;
  for (const [name, message] of Object.entries(error.fields ?? {})) {
    const field = formFields.find((f) => f === name);
    if (field) {
      setError(field, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}

/** Alert colour per code, as in docs/wireframes/Errors.dc.html. */
export function severityFor(code: ApiError['code']): AlertColor {
  switch (code) {
    case 'OTP_EXPIRED':
    case 'ACCOUNT_NOT_VERIFIED':
    case 'RATE_LIMITED':
      return 'warning'; // the user can fix it by doing something
    case 'ALREADY_VERIFIED':
      return 'info'; // not really a problem
    default:
      return 'error';
  }
}
