// URL -> middleware chain -> controller, for /api/auth/*.
// Each line reads left to right in the order Express runs it:
//   1. rate limiter(s) - first, so floods of invalid requests count too
//   2. validate()      - 400 if the body is invalid
//   3. the controller
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  loginIpLimiter,
  loginEmailLimiter,
  signupLimiter,
  verifyLimiter,
  resendMinuteLimiter,
  resendHourLimiter,
} from '../middleware/rateLimits.js';
import {
  signupSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
} from '../validation/auth.schemas.js';
import * as auth from '../controllers/authController.js';

export const authRoutes = Router();

authRoutes.post('/signup', signupLimiter, validate(signupSchema), auth.signup);
authRoutes.post('/verify-otp', verifyLimiter, validate(verifyOtpSchema), auth.verifyOtp);
authRoutes.post('/resend-otp', resendMinuteLimiter, resendHourLimiter, validate(resendOtpSchema), auth.resendOtp);
authRoutes.post('/login', loginIpLimiter, loginEmailLimiter, validate(loginSchema), auth.login);

// No body to validate - these two read the refresh-token cookie.
authRoutes.post('/refresh', auth.refresh);
authRoutes.post('/logout', auth.logout);
