// The one function the rest of the app calls to deliver a code. It picks a
// sender from the message's channel and that channel's mode setting
// (OTP_EMAIL_MODE / OTP_SMS_MODE). The auth service never knows whether the
// code went by console, email or SMS.
import { env } from '../config/env.js';
import { consoleSender } from './senders/consoleSender.js';
import { emailSender } from './senders/emailSender.js';
import { smsSender } from './senders/smsSender.js';

const senders = {
  email: { console: consoleSender, smtp: emailSender },
  sms: { console: consoleSender, twilio: smsSender },
};

/**
 * @param {{ channel: 'email' | 'sms', to: string, code: string }} message
 * Throws if delivery fails - the caller turns that into 502 OTP_DELIVERY_FAILED.
 */
export async function sendOtp(message) {
  const mode = message.channel === 'email' ? env.OTP_EMAIL_MODE : env.OTP_SMS_MODE;
  await senders[message.channel][mode].send(message);
}
