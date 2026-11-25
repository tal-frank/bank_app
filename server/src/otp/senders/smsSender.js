// Sends OTP codes by SMS through Twilio's Messaging API.
// Used only when OTP_SMS_MODE=twilio; config/env.js guarantees the TWILIO_*
// settings exist in that case. Phone numbers are already E.164 (+972...),
// the format Twilio requires.
import twilio from 'twilio';
import { env } from '../../config/env.js';

let client; // created on first use, so console mode never needs Twilio settings

function getClient() {
  // timeout: fail fast instead of leaving the sign-up request hanging.
  client ??= twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, { timeout: 10_000 });
  return client;
}

export const smsSender = {
  async send({ to, code }) {
    await getClient().messages.create({
      to,
      from: env.TWILIO_FROM,
      body: `Your bank verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
    });
  },
};
