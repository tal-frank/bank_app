// User storage - MONGODB version (Phase 3). Same exported functions and the
// same return shapes as the Phase 2 in-memory version, so no service,
// controller or route had to change.
//
// The Phase 2 rules, and how MongoDB keeps them:
//   1. Every function is async - now for real.
//   2. Functions return plain COPIES: `.lean()` gives a plain object instead
//      of a Mongoose document, so changing it can't save anything by accident.
//   3. Every check-then-change is ONE database operation: a unique index for
//      emails, `$inc` for counters, and a condition inside findOneAndUpdate.
//      MongoDB applies each single-document operation atomically, so no other
//      request can sneak in between the check and the change.
//
// Returned user: { id, email, passwordHash, phone, otpChannel, isVerified,
//   balance (agorot), otp: { hash, expiresAt, attempts } | null, createdAt }
import { User } from '../models/User.js';
import { DuplicateEmailError } from './errors.js';
import { toObjectId, withStringId } from './mongoHelpers.js';

// Options for findOneAndUpdate: return the document AFTER the change
// (the default is the old version).
const AFTER = { returnDocument: 'after' };

/** Insert a new user. Throws DuplicateEmailError if the email is taken. */
export async function create(data) {
  try {
    const doc = await User.create(data);
    return withStringId(doc.toObject());
  } catch (err) {
    // 11000 = duplicate key: the unique email index refused the insert.
    // Translate it into OUR storage-neutral error, so the service doesn't
    // need to know MongoDB error codes.
    if (err.code === 11000) throw new DuplicateEmailError(data.email);
    throw err;
  }
}

export async function findById(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  return withStringId(await User.findById(_id).lean());
}

export async function findByEmail(email) {
  return withStringId(await User.findOne({ email }).lean());
}

/** Save changes to a user. Returns the updated user, or null if not found. */
export async function update(id, changes) {
  if ('email' in changes || 'id' in changes || '_id' in changes) {
    throw new Error('userRepo.update cannot change id or email');
  }
  const _id = toObjectId(id);
  if (!_id) return null;
  // $set changes only the given fields; everything else stays as it is.
  // runValidators: also check the schema rules on updates (off by default).
  const doc = await User.findByIdAndUpdate(_id, { $set: changes }, { ...AFTER, runValidators: true }).lean();
  return withStringId(doc);
}

/**
 * Add 1 to the OTP attempt counter and return the updated user.
 * `$inc` does the +1 INSIDE the database. Reading the count, adding 1 in
 * Node and saving it back would let two simultaneous wrong guesses both
 * write the same number - one guess would go uncounted.
 */
export async function incrementOtpAttempts(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  // The condition `otp: { $ne: null }` skips users with no pending code.
  const doc = await User.findOneAndUpdate(
    { _id, otp: { $ne: null } },
    { $inc: { 'otp.attempts': 1 } },
    AFTER,
  ).lean();
  return doc ? withStringId(doc) : findById(id); // same as Phase 2: always return the user
}

/**
 * Verify the account and set its starting balance - but ONLY if it is still
 * unverified. Returns the updated user, or null if it was already verified.
 * The condition `isVerified: false` is part of the SAME operation as the
 * change: if two correct verifications race, only one matches; the other
 * gets null. So the random starting balance is set exactly once.
 */
export async function markVerified(id, startingBalance) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await User.findOneAndUpdate(
    { _id, isVerified: false },
    { $set: { isVerified: true, balance: startingBalance, otp: null } },
    AFTER,
  ).lean();
  return withStringId(doc);
}

/**
 * Delete the user with this email IF it is still unverified AND its code has
 * expired. Returns true if one was deleted.
 * The TTL index does this too, but up to ~60 s late; sign-up calls this so an
 * expired pending account never blocks the email with EMAIL_TAKEN.
 * All three conditions are part of the ONE delete, so a user who verifies at
 * the same instant can't be deleted by mistake.
 */
export async function deleteExpiredPending(email) {
  const result = await User.deleteOne({
    email,
    isVerified: false,
    'otp.expiresAt': { $lte: new Date() },
  });
  return result.deletedCount === 1;
}

/** Remove everything. Only for tests (Phase 12). */
export async function clear() {
  await User.deleteMany({});
}
