// Rate limits for the auth endpoints. The OTP attempt counter protects one
// code; these protect the endpoints themselves from floods (password
// guessing, fake sign-ups, SMS/email spam).
//
// Counters live in memory: they reset on restart and aren't shared between
// several server instances. Fine for this project; production would use a
// shared store such as Redis.
//
// PHASE 6: behind Render's proxy, req.ip is the proxy's address, so all users
// would share one limit. Fix there with app.set('trust proxy', 1).
import { rateLimit, MINUTE, HOUR } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const baseOptions = {
  standardHeaders: 'draft-8', // RateLimit headers tell the client its remaining quota
  legacyHeaders: false,       // skip the old X-RateLimit-* headers
  skip: () => env.NODE_ENV === 'test', // automated tests shouldn't fight the limits
  // Answer in the spec's error shape. The library already set Retry-After.
  handler: (req, res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
  },
};

// Count per email (lowercased, like the validation does). An attacker can
// switch IP addresses, but not the account they're attacking - and a per-
// email limit protects a victim's inbox no matter who sends the requests.
const byEmail = (req) => `email:${String(req.body?.email ?? '').trim().toLowerCase()}`;

// Login: per IP AND per email, 10 tries per 15 minutes each.
export const loginIpLimiter = rateLimit({ ...baseOptions, windowMs: 15 * MINUTE, limit: 10 });
export const loginEmailLimiter = rateLimit({
  ...baseOptions, windowMs: 15 * MINUTE, limit: 10, keyGenerator: byEmail,
});

// Sign-up: 5 per hour per IP - stops mass fake accounts (and SMS costs).
export const signupLimiter = rateLimit({ ...baseOptions, windowMs: HOUR, limit: 5 });

// Verify: 10 per 15 minutes per IP - code guessing across many accounts.
export const verifyLimiter = rateLimit({ ...baseOptions, windowMs: 15 * MINUTE, limit: 10 });

// Resend: 1 per minute AND 5 per hour, per email - every SMS costs money.
export const resendMinuteLimiter = rateLimit({
  ...baseOptions, windowMs: MINUTE, limit: 1, keyGenerator: byEmail,
});
export const resendHourLimiter = rateLimit({
  ...baseOptions, windowMs: HOUR, limit: 5, keyGenerator: byEmail,
});
