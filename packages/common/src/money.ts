import { z } from 'zod';

/**
 * Canonical schema for a monetary amount.
 * `amount` is the numeric value; `currency` is an ISO 4217 code (e.g. "USD").
 */
export const moneyAmountSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

/** A monetary amount with currency. */
export type MoneyAmount = z.infer<typeof moneyAmountSchema>;
