// Rules for listing transactions and transferring money (requirements 3c, 5).
import { AppError } from '../utils/AppError.js';
import * as userRepo from '../repositories/userRepo.js';
import * as transactionRepo from '../repositories/transactionRepo.js';
import { InsufficientFundsError } from '../repositories/errors.js';
import { toTransactionView } from '../utils/toTransactionView.js';
import { loadCurrentUser } from './userService.js';

export async function list(userId, { page, limit }) {
  await loadCurrentUser(userId);
  const { items, total } = await transactionRepo.listForUser({ userId, page, limit });
  return { items: items.map((tx) => toTransactionView(tx, userId)), page, limit, total };
}

export async function transfer(senderId, { toEmail, amount }) {
  const sender = await loadCurrentUser(senderId);

  // Cheap check first. Both emails are already lowercased, so
  // "Dana@x.com" -> "dana@x.com" is caught too.
  if (toEmail === sender.email) {
    throw new AppError(400, 'SELF_TRANSFER', "You can't send money to yourself.");
  }

  // Unverified accounts aren't customers yet (no balance). Same 404 as
  // "not found", so this can't reveal which emails have pending accounts.
  const receiver = await userRepo.findByEmail(toEmail);
  if (!receiver || !receiver.isVerified) {
    throw new AppError(404, 'RECIPIENT_NOT_FOUND', 'No user found with this email.');
  }

  // NO balance check here: another transfer could run between this line and
  // the repository. The repository checks inside its atomic step.
  try {
    const { transaction, senderBalance } = await transactionRepo.transfer({
      fromId: sender.id,
      toId: receiver.id,
      amount,
    });
    return { transaction: toTransactionView(transaction, sender.id), balance: senderBalance };
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      throw new AppError(422, 'INSUFFICIENT_FUNDS', 'Your balance is too low for this transfer.');
    }
    throw err;
  }
}
