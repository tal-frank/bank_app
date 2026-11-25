// /transactions endpoints. Whose transactions comes from the token, never a parameter.
import { api } from './client';
import type { TransactionPage, TransferResponse } from './types';

/** GET /transactions?page=&limit= - newest first. limit is capped at 50 by the server. */
export async function listTransactions(page: number, limit: number): Promise<TransactionPage> {
  // `params` builds the query string (?page=2&limit=10) and encodes it safely.
  const res = await api.get<TransactionPage>('/transactions', { params: { page, limit } });
  return res.data;
}

/**
 * POST /transactions - send money. `amount` is integer agorot (a NUMBER, not text).
 * The sender is whoever the token belongs to; there's no "from" field on purpose.
 */
export async function createTransfer(toEmail: string, amount: number): Promise<TransferResponse> {
  const res = await api.post<TransferResponse>('/transactions', { toEmail, amount });
  return res.data;
}
