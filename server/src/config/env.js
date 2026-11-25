// Loads settings from .env (and the real environment), checks them, and
// exports one frozen `env` object. Every other file imports settings from
// here instead of reading process.env directly, so:
//   - a missing or invalid setting stops the server at startup with a clear
//     message, instead of failing later in the middle of a request;
//   - values have the right type (PORT is a number, not the string "3000");
//   - there is one place that lists every setting the server uses.
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Find server/.env relative to THIS file, so it's found no matter which
// folder you start node from. `quiet` stops dotenv printing a banner.
// Values already set in the real environment (e.g. on Render) win over .env.
dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

// The rules for each setting. `.default()` makes a setting optional in
// development; secrets added on day 2 (JWT, SMTP, Twilio) will have no
// default, so the server refuses to start without them.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Environment variables are always strings; coerce turns "3000" into 3000.
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // The React app's address. CORS lets ONLY this origin call the API.
  CLIENT_URL: z.url().default('http://localhost:5173'),

  // ---- Database (Phase 3) ----
  // MongoDB connection string. NO default: without a database the app can't
  // do anything, so it must not start. The regex catches the most common
  // mistake (pasting something that isn't a connection string) at startup.
  // We never print this value: it contains the database password.
  MONGODB_URI: z
    .string()
    .trim()
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv:// (see .env.example)'),

  // ---- Auth (day 2) ----
  // Signs access tokens. NO default on purpose: the server must never run
  // with a guessable secret. Generate one with:
  //   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters (see .env.example)'),
  // Lifetimes are settings so tests can use tiny values to check expiry.
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // How OTP codes are delivered, per channel. 'console' prints them in the
  // server log (a stub for development, never for real users).
  OTP_EMAIL_MODE: z.enum(['console', 'smtp']).default('console'),
  OTP_SMS_MODE: z.enum(['console', 'twilio']).default('console'),

  // Email (Nodemailer) - required only when OTP_EMAIL_MODE=smtp.
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().trim().optional(),

  // SMS (Twilio) - required only when OTP_SMS_MODE=twilio.
  TWILIO_ACCOUNT_SID: z.string().trim().optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().optional(),
  TWILIO_FROM: z.string().trim().optional(),
}).superRefine((e, ctx) => {
  const problem = (key, message) => ctx.addIssue({ code: 'custom', path: [key], message });

  // Safety net: printing codes to a log in production would let anyone with
  // log access verify any account.
  if (e.NODE_ENV === 'production') {
    if (e.OTP_EMAIL_MODE === 'console') problem('OTP_EMAIL_MODE', "'console' is not allowed in production");
    if (e.OTP_SMS_MODE === 'console') problem('OTP_SMS_MODE', "'console' is not allowed in production");
  }

  // A real mode without its credentials fails HERE, at startup - not in the
  // middle of someone's sign-up. Empty values (KEY=) count as missing.
  if (e.OTP_EMAIL_MODE === 'smtp') {
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
      if (!e[key]) problem(key, 'required when OTP_EMAIL_MODE=smtp');
    }
  }
  if (e.OTP_SMS_MODE === 'twilio') {
    for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']) {
      if (!e[key]) problem(key, 'required when OTP_SMS_MODE=twilio');
    }
  }
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1); // fail fast: don't run with a broken configuration
}

// Object.freeze: settings can't be changed by accident at runtime.
export const env = Object.freeze(result.data);
