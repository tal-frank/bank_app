// Shows one stored transaction from the CALLER's point of view (requirement 5c):
//   sender sees:   direction 'sent',     the receiver's email, amount -2500
//   receiver sees: direction 'received', the sender's email,   amount +2500
// One stored record, two views - so the two sides can never disagree.
export function toTransactionView(tx, viewerId) {
  const sent = tx.fromId === viewerId;
  return {
    id: tx.id,
    direction: sent ? 'sent' : 'received',
    counterpartyEmail: sent ? tx.toEmail : tx.fromEmail,
    amount: sent ? -tx.amount : tx.amount,
    createdAt: tx.createdAt,
  };
}
