// The API's main router, mounted at /api in app.js. Each feature gets its own
// router file, plugged in here (added on day 2):
//
//   router.use('/auth', authRoutes);
//   router.use('/users', userRoutes);
//   router.use('/transactions', transactionRoutes);
//
// Keeping this list in one place makes it easy to see every part of the API.
import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { usersRoutes } from './users.routes.js';
import { transactionsRoutes } from './transactions.routes.js';

export const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/transactions', transactionsRoutes);

// GET /api/health - liveness check from openapi.yaml. Render and Docker call
// it to know the server is up. It must stay cheap and never touch user data.
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
