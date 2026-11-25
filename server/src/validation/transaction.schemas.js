// zod schemas for /api/transactions. Mirror openapi.yaml.
import { z } from 'zod';
import { email } from './common.js';

// POST body. No coercion: a JSON body has real numbers, so "2500" (text) is
// a frontend bug we want to see as a 400, not quietly accept.
export const transferSchema = z
  .object({
    toEmail: email,
    amount: z
      .number({ error: 'Must be a number.' })
      .int('Must be a whole number of agorot.')
      .min(1, 'Must be at least 1 agora.')
      .max(100_000_000, 'Too large for one transfer.'), // ₪1,000,000
  })
  .strict();

// Query string (?page=2&limit=10). Query values are always text, so here we
// DO coerce "2" -> 2. Defaults apply when a parameter is missing.
export const pageSchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Must be 1 or more.').default(1),
    limit: z.coerce.number().int().min(1, 'Must be 1 or more.').max(50, 'Must be 50 or less.').default(10),
  })
  .strict();
