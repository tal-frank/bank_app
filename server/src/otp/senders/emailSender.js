// Sends OTP codes by email through any SMTP server (Nodemailer).
// Development: an Ethereal test inbox. Later: e.g. Gmail with an app password.
// Used only when OTP_EMAIL_MODE=smtp; config/env.js guarantees the SMTP_*
// settings exist in that case.
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

let transporter; // created on first use, so console mode never needs SMTP settings

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // Fail fast instead of leaving the sign-up request hanging if the SMTP
    // server is slow or unreachable. The failure becomes 502 OTP_DELIVERY_FAILED.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export const emailSender = {
  async send({ to, code }) {
    const info = await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to,
      subject: 'Your verification code',
      // Plain text AND HTML: some email apps show only one. No links - a code
      // email with a link looks like phishing.
      text: `Your verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your verification code is <b>${code}</b>.</p><p>It expires in ${env.OTP_TTL_MINUTES} minutes.</p>`,
    });

    // Ethereal only: a web link to view the "sent" email. False for real servers.
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[OTP] email preview: ${preview}`);
  },
};
