// Development-only OTP "sender": prints the code in the server log instead
// of emailing or texting it. Lets you test the whole sign-up flow without
// email or Twilio accounts. config/env.js refuses OTP_MODE=console in
// production.
//
// Every sender has the same shape - an object with async send({ channel, to, code }) -
// so otpService can swap them without the rest of the app knowing.
export const consoleSender = {
  async send({ channel, to, code }) {
    console.log(`[OTP] ${channel} to ${to}: ${code}`);
  },
};
