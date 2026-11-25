// One-time passcodes: 6 random digits, stored only as a bcrypt hash.
//
// Why crypto.randomInt and not Math.random: Math.random is not designed to
// be unpredictable - with enough outputs its next values can be guessed.
// crypto.randomInt uses the operating system's secure random source.
//
// Why bcrypt (slow) and not SHA-256 (fast) for the hash: there are only
// 1,000,000 possible codes. With a fast hash, someone who sees the stored
// hash could try all of them in well under a second and find the code.
// bcrypt makes that slow. Cost 10 instead of 12: a code lives only 5
// minutes and the endpoint allows 5 attempts, so less is needed than for
// passwords, which live for years.
import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';

const COST = 10;

/** A string, not a number, so a leading zero survives: "048213". */
export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(code) {
  return bcrypt.hash(code, COST);
}

export function verifyOtpCode(code, hash) {
  return bcrypt.compare(code, hash);
}
