// One function per /auth endpoint. Pages call these, never axios directly, so a
// changed URL or shape is fixed in one place.
import { api } from './client';
import type { AuthResponse, OtpChannel, SignupResponse } from './types';

/** POST /auth/signup - creates an unverified account and sends the code. */
export async function signup(body: {
  email: string;
  password: string;
  phone: string;
  otpChannel: OtpChannel;
}): Promise<SignupResponse> {
  const res = await api.post<SignupResponse>('/auth/signup', body);
  return res.data;
}

/** POST /auth/verify-otp - verifies AND signs in (same response as login). */
export async function verifyOtp(email: string, code: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/verify-otp', { email, code });
  return res.data;
}

/** POST /auth/resend-otp - new code over the channel chosen at sign-up. Max 1/min. */
export async function resendOtp(email: string): Promise<SignupResponse> {
  const res = await api.post<SignupResponse>('/auth/resend-otp', { email });
  return res.data;
}

/** POST /auth/login - also sets the refresh cookie (the browser stores it). */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

/** POST /auth/logout - revokes the refresh token and clears the cookie. Always 204. */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
