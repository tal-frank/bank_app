// zod schemas for the auth request bodies. They mirror the request schemas in
// openapi.yaml - if you change a rule here, change it there too.
//
// Used with the validate() middleware in routes/auth.routes.js. On success,
// the CLEANED data (trimmed, lowercased) is in req.validated.body.
//
// The messages are written for end users: the frontend shows each one under
// the matching form field.
import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { text, email } from './common.js';

const password = text()
  .min(8, 'Must be at least 8 characters.')
  .max(72, 'Must be at most 72 characters.') // bcrypt ignores anything after 72 bytes
  .regex(/[A-Za-z]/, 'Must contain a letter.')
  .regex(/\d/, 'Must contain a digit.');

// Two checks: the regex enforces the exact E.164 format we store (no spaces
// or dashes), and libphonenumber-js checks the number really exists for its
// country - "+972 1" has the right shape but isn't a real Israeli number.
const phone = text()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +972501234567.')
  .refine((value) => isValidPhoneNumber(value), 'This phone number is not valid.');

// .strict() rejects unknown fields, so a client can't sneak in
// e.g. { "balance": 999999 } or { "isVerified": true }.
export const signupSchema = z
  .object({
    email,
    password,
    phone,
    otpChannel: z.enum(['email', 'sms'], { error: "Must be 'email' or 'sms'." }),
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    email,
    code: text().regex(/^\d{6}$/, 'The code is 6 digits.'),
  })
  .strict();

export const resendOtpSchema = z.object({ email }).strict();

export const loginSchema = z
  .object({
    email,
    // No password rules at login on purpose: we only compare against the
    // stored hash. If the rules change later, old users can still log in.
    password: text().min(1, 'This field is required.').max(72, 'Must be at most 72 characters.'),
  })
  .strict();
