// /api/transactions - every route here needs a valid access token.
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pageSchema, transferSchema } from '../validation/transaction.schemas.js';
import * as transactions from '../controllers/transactionController.js';

export const transactionsRoutes = Router();

transactionsRoutes.use(auth); // applies to every route below

transactionsRoutes.get('/', validate(pageSchema, 'query'), transactions.list);
transactionsRoutes.post('/', validate(transferSchema), transactions.create);
