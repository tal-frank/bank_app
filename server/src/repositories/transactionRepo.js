// Transaction storage - MONGODB version (Phase 3). Same functions and return
// shapes as the Phase 2 version.
//
// Returned transaction:
//   { id, fromId, toId, fromEmail, toEmail, amount (agorot, positive), createdAt }
// (ids as strings.) The emails are copied in at transfer time on purpose:
// listing needs no user lookups, and a payment record keeps what was true then.
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { InsufficientFundsError } from './errors.js';
import { toObjectId, withStringId } from './mongoHelpers.js';

function toTx(doc) {
  const tx = withStringId(doc);
  return { ...tx, fromId: tx.fromId.toString(), toId: tx.toId.toString() };
}

/**
 * Move `amount` agorot from one user to another and record it.
 *
 * Three writes: debit the sender, credit the receiver, insert the record.
 * Each one alone is atomic, but together they are NOT: if the server crashed
 * after the debit, the money would vanish. A MongoDB TRANSACTION makes the
 * three all-or-nothing - either every write is saved, or none is.
 * (Transactions need a replica set. Atlas clusters always are one.)
 *
 * Throws InsufficientFundsError if the sender's balance is too low.
 * Returns { transaction, senderBalance }.
 */
export async function transfer({ fromId, toId, amount }) {
  const fromOid = toObjectId(fromId);
  const toOid = toObjectId(toId);
  if (!fromOid || !toOid) {
    throw new Error('transactionRepo.transfer: user not found'); // the service checks this first
  }

  // A session ties the operations together; every query inside the
  // transaction must pass `{ session }`, or it runs OUTSIDE the transaction.
  const session = await mongoose.startSession();
  try {
    let result;
    // withTransaction: starts the transaction, runs our function, commits.
    // If our function throws, it aborts (nothing is saved) and rethrows.
    // If two transfers touch the same user at once, MongoDB reports a write
    // conflict and withTransaction RETRIES our function from the start, so it
    // must not depend on anything from a previous attempt.
    await session.withTransaction(async () => {
      // The debit with the balance check IN THE FILTER: the document only
      // matches if balance >= amount, so the check and the debit are one
      // atomic step. The balance can never go below zero.
      const sender = await User.findOneAndUpdate(
        { _id: fromOid, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session, returnDocument: 'after', projection: { email: 1, balance: 1 } },
      ).lean();

      if (!sender) {
        // No match: either the balance is too low, or the user is gone.
        const exists = await User.exists({ _id: fromOid }).session(session);
        if (!exists) throw new Error('transactionRepo.transfer: user not found');
        throw new InsufficientFundsError(); // aborts the transaction
      }

      const receiver = await User.findOneAndUpdate(
        { _id: toOid },
        { $inc: { balance: amount } },
        { session, returnDocument: 'after', projection: { email: 1 } },
      ).lean();
      if (!receiver) {
        // Throwing aborts the transaction, so the debit above is undone too.
        throw new Error('transactionRepo.transfer: user not found');
      }

      // create() with { session } needs an ARRAY of documents (Mongoose rule).
      const [tx] = await Transaction.create(
        [{ fromId: fromOid, toId: toOid, fromEmail: sender.email, toEmail: receiver.email, amount }],
        { session },
      );

      result = { transaction: toTx(tx.toObject()), senderBalance: sender.balance };
    });
    return result;
  } finally {
    await session.endSession(); // always give the session back
  }
}

/** One page of a user's transactions (sent or received), newest first. */
export async function listForUser({ userId, page, limit }) {
  const _id = toObjectId(userId);
  if (!_id) return { items: [], total: 0 };

  const filter = { $or: [{ fromId: _id }, { toId: _id }] };
  // Run the page query and the count at the same time (both are reads).
  const [docs, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1, _id: -1 }) // _id breaks ties within the same millisecond
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);
  return { items: docs.map(toTx), total };
}

/** Remove everything. Only for tests (Phase 12). */
export async function clear() {
  await Transaction.deleteMany({});
}
