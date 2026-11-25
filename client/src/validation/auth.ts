// Form rules, copied from server/src/validation/auth.schemas.js + common.js
// (same rules, same messages). Why both sides: the client gives instant
// feedback; the server is the real guard, since anyone can bypass this page.
// If a server rule changes, change it here too.
import { z } from 'zod';

// Same as the server: trim + lowercase, then check the format.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Must be a valid email address.').max(254, 'Email is too long.'));

const password = z
  .string()
  .min(8, 'Must be at least 8 characters.')
  .max(72, 'Must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Must contain a letter.')
  .regex(/\d/, 'Must contain a digit.');

// Format only. The server also runs libphonenumber (is this a real number for
// that country?); that library would add ~150 kB here, so its rare error comes
// back from the server and is shown under the field instead.
const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +972501234567.');

export const signupSchema = z.object({
  email,
  password,
  phone,
  otpChannel: z.enum(['email', 'sms']),
});

export const verifyOtpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits.'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'This field is required.').max(72, 'Must be at most 72 characters.'),
});

// z.input = what the form holds; z.output = what we send after trim/lowercase.
export type SignupInput = z.input<typeof signupSchema>;
export type SignupValues = z.output<typeof signupSchema>;
export type VerifyOtpInput = z.input<typeof verifyOtpSchema>;
export type VerifyOtpValues = z.output<typeof verifyOtpSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
