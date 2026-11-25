// Password hashing with bcrypt.
//
// Why bcrypt and not e.g. SHA-256: bcrypt is deliberately SLOW (cost 12 is
// about 250 ms per hash) and adds a random salt to each hash. A user won't
// notice 250 ms at login, but an attacker with a leaked database who wants
// to try millions of guesses per account is slowed down enormously. The salt
// means two users with the same password get different hashes.
//
// bcrypt only uses the first 72 bytes of a password - that's why the
// validation schemas cap passwords at 72 characters.
import bcrypt from 'bcrypt';

const COST = 12; // each +1 doubles the time

export function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// A real hash of a throwaway value. Login compares against it when the email
// doesn't exist, so "unknown email" takes as long as "wrong password".
// Without it, the fast answer for unknown emails would reveal which emails
// have accounts, even though the error message is the same.
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);
