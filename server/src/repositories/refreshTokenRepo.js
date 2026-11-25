// Refresh-token storage - MONGODB version (Phase 3). Same functions and
// return shapes as the Phase 2 version.
//
// We store only the token's SHA-256 HASH, never the token itself.
// The model has a TTL index: MongoDB deletes records after expiresAt.
//
// Returned record: { tokenHash, userId (string), expiresAt, revokedAt | null, createdAt }
import { RefreshToken } from '../models/RefreshToken.js';
import { toObjectId } from './mongoHelpers.js';

// The service never needs the record's own _id; userId goes out as a string.
function toRecord(doc) {
  if (!doc) return null;
  const { _id, userId, ...rest } = doc;
  return { ...rest, userId: userId.toString() };
}

export async function create({ tokenHash, userId, expiresAt }) {
  const doc = await RefreshToken.create({ tokenHash, userId: toObjectId(userId), expiresAt });
  return toRecord(doc.toObject());
}

export async function findByHash(tokenHash) {
  return toRecord(await RefreshToken.findOne({ tokenHash }).lean());
}

/**
 * Revoke one token. Returns true if THIS call revoked it, false if it was
 * missing or already revoked. The condition `revokedAt: null` makes the
 * check and the change one atomic step: if two requests use the same refresh
 * token at once, only one modifies the document (modifiedCount 1); the other
 * gets 0 and is treated as token reuse.
 */
export async function revoke(tokenHash) {
  const result = await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  return result.modifiedCount === 1;
}

/** Revoke every active token of a user - signs out all their sessions. */
export async function revokeAllForUser(userId) {
  const _id = toObjectId(userId);
  if (!_id) return;
  await RefreshToken.updateMany({ userId: _id, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/** Remove everything. Only for tests (Phase 12). */
export async function clear() {
  await RefreshToken.deleteMany({});
}
