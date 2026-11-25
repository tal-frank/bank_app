// HTTP side of /api/transactions. Thin: auth set req.user, validate set req.validated.
import * as transactionService from '../services/transactionService.js';

// GET /api/transactions?page=&limit= -> 200 TransactionPage
export async function list(req, res) {
  res.json(await transactionService.list(req.user.id, req.validated.query));
}

// POST /api/transactions -> 201 TransferResponse
export async function create(req, res) {
  res.status(201).json(await transactionService.transfer(req.user.id, req.validated.body));
}
