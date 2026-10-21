import { logger } from '@op/logging';
import { z } from 'zod';

import {
  DEFAULT_MONEY_CURRENCY,
  getCurrencySymbol,
  isValidCurrencyCode,
} from '../../money';
import { getMoneyFieldCurrency, isMoneyFieldSchema } from './rubric/money';
import type { XFormatPropertySchema } from './types';

const CUSTOM_UNIT_LABEL_MAX_LENGTH = 40;

export const amountUnitSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('currency'), code: z.string().min(1) }),
  z.object({
    kind: z.literal('custom'),
    label: z.string().trim().min(1).max(CUSTOM_UNIT_LABEL_MAX_LENGTH),
  }),
]);

export type AmountUnit = z.infer<typeof amountUnitSchema>;

const unitAmountValueSchema = z.union([
  z.object({ amount: z.number(), currency: z.string().optional() }),
  z
    .union([z.number(), z.string().trim().min(1)])
    .pipe(z.coerce.number())
    .transform((amount) => ({ amount, currency: undefined })),
]);

function unitKey(unit: AmountUnit): string {
  return unit.kind === 'currency'
    ? `currency:${unit.code.toUpperCase()}`
    : `custom:${unit.label.trim()}`;
}

export function isSameUnit(a: AmountUnit, b: AmountUnit): boolean {
  return unitKey(a) === unitKey(b);
}

// Enough for any stored amount; past this, scaling would leave safe-integer range.
const MAX_DECIMAL_PLACES = 10;

// `toExponential` is the shortest round-trip form, so `0.004` is 3, not 17.
function decimalPlaces(amount: number): number {
  const [mantissa = '', exponent = '0'] = amount.toExponential().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;

  return Math.min(MAX_DECIMAL_PLACES, Math.max(0, fraction - Number(exponent)));
}

function sharedScale(amounts: readonly number[]): number {
  return 10 ** Math.max(0, ...amounts.map(decimalPlaces));
}

// Integer arithmetic at the inputs' own precision, so `0.1 + 0.2` is `0.3`
// and three costs of `0.004` are `0.012`, not `0`.
export function sumAmounts(amounts: readonly number[]): number {
  const scale = sharedScale(amounts);

  return (
    amounts.reduce((sum, amount) => sum + Math.round(amount * scale), 0) / scale
  );
}

export function isAtMost({
  amount,
  limit,
}: {
  amount: number;
  limit: number;
}): boolean {
  const scale = sharedScale([amount, limit]);

  return Math.round(amount * scale) <= Math.round(limit * scale);
}

// A money field's unit is its currency; any other field declares one with `x-unit`.
export function getFieldUnit(
  schema: XFormatPropertySchema | undefined,
): AmountUnit | undefined {
  if (!schema) {
    return undefined;
  }

  if (isMoneyFieldSchema(schema)) {
    return {
      kind: 'currency',
      code: getMoneyFieldCurrency(schema) ?? DEFAULT_MONEY_CURRENCY,
    };
  }

  const declared = schema['x-unit'];
  if (declared === undefined) {
    return undefined;
  }

  const parsed = amountUnitSchema.safeParse(declared);
  if (
    parsed.success &&
    (parsed.data.kind === 'custom' || isValidCurrencyCode(parsed.data.code))
  ) {
    return parsed.data;
  }

  logger.warn('Ignoring malformed x-unit on a template field', {
    title: schema.title,
  });
  return undefined;
}

// A value stamped with a different currency predates a template re-pin, so it
// resolves to null rather than being recounted in the new unit. A negative
// amount is null too, so it can't lower a ballot total.
export function getFieldAmount({
  value,
  unit,
}: {
  value: unknown;
  unit: AmountUnit;
}): number | null {
  const parsed = unitAmountValueSchema.safeParse(value);

  if (
    !parsed.success ||
    !Number.isFinite(parsed.data.amount) ||
    parsed.data.amount < 0
  ) {
    return null;
  }

  const { amount, currency } = parsed.data;

  if (
    currency !== undefined &&
    !isSameUnit({ kind: 'currency', code: currency }, unit)
  ) {
    return null;
  }

  return amount;
}

export function getUnitLabel(unit: AmountUnit): string {
  return unit.kind === 'currency'
    ? getCurrencySymbol(unit.code)
    : unit.label.trim();
}

export function formatUnitAmount({
  amount,
  unit,
}: {
  amount: number;
  unit: AmountUnit;
}): string {
  return unit.kind === 'currency'
    ? `${getUnitLabel(unit)}${amount}`
    : `${amount} ${getUnitLabel(unit)}`;
}
