import { type MoneyAmount, moneyAmountSchema } from '../money';
import { sumAmounts } from '../services/decision/fieldUnit';
import type { ValueType } from './valueType';

// Strict, so an object that only has an amount and a currency among other
// keys is not read as money.
const moneyValueSchema = moneyAmountSchema.strict();

export const moneyValueType = {
  parse(value) {
    return moneyValueSchema.validate(value) ? value : undefined;
  },
  add(a, b) {
    if (a.currency !== b.currency) {
      return undefined;
    }
    return { amount: sumAmounts([a.amount, b.amount]), currency: a.currency };
  },
} satisfies ValueType<MoneyAmount>;
