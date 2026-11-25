// Send-money form rules, mirroring server/src/validation/transaction.schemas.js
// (same limits, same messages). The form holds TEXT; after zod, onSubmit gets
// the amount as integer agorot, ready to send.
import { z } from 'zod';
import { parseShekelsToAgorot } from '../utils/money';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Must be a valid email address.').max(254, 'Email is too long.'));

export const transferSchema = z.object({
  toEmail: email,
  amount: z
    .string()
    .trim()
    .min(1, 'This field is required.')
    // ₪ text -> agorot, or a field error if it isn't an amount.
    .transform((text, ctx) => {
      const agorot = parseShekelsToAgorot(text);
      if (agorot === null) {
        ctx.addIssue({ code: 'custom', message: 'Enter an amount like 25 or 25.50 (up to 2 decimals).' });
        return z.NEVER; // stop here; the error above is the result
      }
      return agorot;
    })
    // Then the server's own limits, on the agorot number.
    .pipe(
      z
        .number()
        .int()
        .min(1, 'Must be at least 1 agora.')
        .max(100_000_000, 'Too large for one transfer.'), // ₪1,000,000
    ),
});

export type TransferInput = z.input<typeof transferSchema>; // { toEmail: string; amount: string }
export type TransferValues = z.output<typeof transferSchema>; // { toEmail: string; amount: number }
