// Small helpers shared by the Mongo repositories. They keep MongoDB's id
// type INSIDE the repository layer: the rest of the app only ever sees ids as
// plain strings, exactly like in Phase 2.
import mongoose from 'mongoose';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Turn a string id into an ObjectId, or null if it isn't a valid one.
 * Without this, a bad id (an old token from the in-memory days held a UUID)
 * would make Mongoose throw a CastError -> a 500. With it, the repository
 * simply finds nothing -> the service answers 401/404 as usual.
 */
export function toObjectId(id) {
  return typeof id === 'string' && OBJECT_ID.test(id) ? new mongoose.Types.ObjectId(id) : null;
}

/**
 * MongoDB's `_id` (an ObjectId) -> our `id` (a string). Every repository
 * function returns documents through this, so callers get the same plain
 * object shape the in-memory version returned.
 */
export function withStringId(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}
