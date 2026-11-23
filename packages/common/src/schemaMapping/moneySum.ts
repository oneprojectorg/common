import { isDeepStrictEqual } from 'node:util';

import { type MoneyAmount, moneyAmountSchema } from '../money';
import { evaluateExpression } from '../services/decision/selectionPipeline/expressionEvaluator';
import { isEmptyValue, readOwnField } from './fieldPath';
import type { MappingInput, MoneySum } from './schema';

/**
 * The total of a `moneySum` rule. Each input gives the sum of its present
 * fields, each source the total its inputs agree on, and the result is the
 * sum over all sources. A source without a total, a disagreement, a mixed
 * currency or a total of 0 or less gives no value, so a partial sum is never
 * filled.
 */
export const resolveMoneySum = ({
  rule,
  inputs,
  sourceIds,
}: {
  rule: MoneySum;
  /** The inputs of the rule's source schema. */
  inputs: MappingInput[];
  /** Every source of the target, also those without an input here. */
  sourceIds: string[];
}): MoneyAmount | undefined => {
  const totalsBySource = new Map<string, MoneyAmount[]>();
  for (const input of inputs) {
    const total = getInputTotal({ data: input.data, paths: rule.moneySum });
    if (total === 'invalid') {
      return undefined;
    }
    if (total !== 'none') {
      const totals = totalsBySource.get(input.sourceId) ?? [];
      totals.push(total);
      totalsBySource.set(input.sourceId, totals);
    }
  }

  const sourceTotals: MoneyAmount[] = [];
  for (const sourceId of sourceIds) {
    const [first, ...rest] = totalsBySource.get(sourceId) ?? [];
    if (!first || !rest.every((total) => isDeepStrictEqual(first, total))) {
      return undefined;
    }
    sourceTotals.push(first);
  }

  const total = addMoney(sourceTotals);
  return total && total.amount > 0 ? total : undefined;
};

const getInputTotal = ({
  data,
  paths,
}: {
  data: unknown;
  paths: string[];
}): MoneyAmount | 'none' | 'invalid' => {
  const values: MoneyAmount[] = [];
  for (const path of paths) {
    const value = readOwnField({ data, path });
    if (isEmptyValue(value)) {
      continue;
    }
    const money = moneyAmountSchema.safeParse(value);
    if (!money.success || !Number.isFinite(money.data.amount)) {
      return 'invalid';
    }
    values.push(money.data);
  }
  if (values.length === 0) {
    return 'none';
  }
  return addMoney(values) ?? 'invalid';
};

/** Undefined for no values or mixed currencies. */
const addMoney = (values: MoneyAmount[]): MoneyAmount | undefined => {
  const [first] = values;
  if (!first || values.some((value) => value.currency !== first.currency)) {
    return undefined;
  }
  // Each operand is a checked number: the evaluator reads a missing one as 0.
  const amount: unknown = evaluateExpression(
    {
      operator: 'add',
      operands: values.map((value) => ({ value: value.amount })),
    },
    { record: {}, variables: {}, outputs: {} },
  );
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return undefined;
  }
  const scale = Math.max(
    ...values.map((value) => getDecimalPlaces(value.amount)),
  );
  return { amount: roundToScale({ amount, scale }), currency: first.currency };
};

/** Drops float noise (0.1 + 0.2) at the finest precision of the inputs. */
const roundToScale = ({
  amount,
  scale,
}: {
  amount: number;
  scale: number;
}): number => Number(amount.toFixed(Math.min(scale, 100)));

const getDecimalPlaces = (amount: number): number => {
  const [mantissa = '', exponent = '0'] = String(amount).split('e');
  const fractionDigits = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fractionDigits - Number(exponent));
};
