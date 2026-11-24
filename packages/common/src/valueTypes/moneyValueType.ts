import { type MoneyAmount, moneyAmountSchema } from '../money';
import { sumAmounts } from '../services/decision/fieldUnit';
import type { ValueType } from './valueType';

// Strict, so an object that only has an amount and a currency among other
// keys is not read as money.
const moneyValueSchema = moneyAmountSchema.strict();

export const moneyValueType: ValueType<MoneyAmount> = {
  parse(value) {
    const result = moneyValueSchema.safeParse(value);
    // zod rejects NaN but lets Infinity through
    return result.success && Number.isFinite(result.data.amount)
      ? result.data
      : undefined;
  },
  add(a, b) {
    if (a.currency !== b.currency) {
      return undefined;
    }
    return { amount: sumAmounts([a.amount, b.amount]), currency: a.currency };
  },
};
