/**
 * The unit a budget amount is counted in.
 *
 * A process declares it once, on the template's `budget` field, via the
 * `x-unit` vendor extension — never on the stored values, which would drift
 * apart as a template is re-pinned. See
 * `docs/adr/0005-declare-budget-units-on-the-template.md`.
 */
import { logger } from '@op/logging';
import { z } from 'zod';

import {
  DEFAULT_MONEY_CURRENCY,
  getCurrencySymbol,
  isValidCurrencyCode,
} from '../../money';
import { type BudgetData, normalizeBudget } from './proposalDataSchema';
import { getMoneyFieldCurrency } from './rubric/money';
import { templateCollectsBudget } from './templateBudget';
import type { ProposalTemplateSchema, XFormatPropertySchema } from './types';

/** Cap on a custom unit label, in characters — it renders as an affix. */
const CUSTOM_UNIT_LABEL_MAX_LENGTH = 40;

export const amountUnitSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('currency'), code: z.string().min(1) }),
  z.object({
    kind: z.literal('custom'),
    label: z.string().trim().min(1).max(CUSTOM_UNIT_LABEL_MAX_LENGTH),
  }),
]);

/** A currency (ISO 4217) or an arbitrary label — "dots", "points", "votes". */
export type AmountUnit = z.infer<typeof amountUnitSchema>;

/** Unit assumed when neither `x-unit` nor the template's currency property pins one. */
export const DEFAULT_AMOUNT_UNIT = {
  kind: 'currency',
  code: DEFAULT_MONEY_CURRENCY,
} satisfies AmountUnit;

/** An amount in a declared unit — the in-memory shape every budget resolves to. */
export interface UnitAmount {
  amount: number;
  unit: AmountUnit;
}

/**
 * Canonical form, so two units that name the same thing compare equal however
 * they were spelled: currency codes are compared upper-case (ISO 4217 is
 * case-insensitive, and stored values predate any normalization), custom
 * labels trimmed.
 */
function unitKey(unit: AmountUnit): string {
  return unit.kind === 'currency'
    ? `currency:${unit.code.toUpperCase()}`
    : `custom:${unit.label.trim()}`;
}

/** Whether two units name the same thing. */
export function isSameUnit(a: AmountUnit, b: AmountUnit): boolean {
  return unitKey(a) === unitKey(b);
}

/**
 * Fixed-point integer (2 decimals) so sums and comparisons never hit float
 * drift — `0.1 + 0.2 > 0.3` would reject a ballot that exactly meets its
 * budget. Applies to any unit; custom units are integers in practice and
 * none of the currencies the builder offers has more than 2 decimals.
 */
export function toFixedPointUnits(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * The unit declared on a template budget field.
 *
 * `x-unit` is the source of truth and wins outright. `properties.currency`
 * belongs to currency-kind budgets only, and survives as the fallback for
 * every template written before `x-unit` existed — including the canonical
 * `budget` field in `schemas/definitions.ts`, which declares no `x-unit` and
 * so resolves through the currency it pins (`const`, else `default`). With
 * neither, {@link DEFAULT_AMOUNT_UNIT}.
 *
 * This is the only reader of `x-unit`.
 */
export function getFieldUnit(
  schema: XFormatPropertySchema | undefined,
): AmountUnit {
  if (!schema) {
    return DEFAULT_AMOUNT_UNIT;
  }

  const declared = schema['x-unit'];
  if (declared !== undefined) {
    const parsed = amountUnitSchema.safeParse(declared);

    if (parsed.success) {
      const unit = parsed.data;
      if (unit.kind === 'custom' || isValidCurrencyCode(unit.code)) {
        return unit;
      }
    }

    // A unit we can't honour: fall back rather than count amounts in a unit
    // nothing can render.
    logger.warn('Ignoring malformed x-unit on a budget field', {
      fallbackUnit: DEFAULT_AMOUNT_UNIT.code,
    });
    return DEFAULT_AMOUNT_UNIT;
  }

  const pinnedCurrency = getMoneyFieldCurrency(schema);

  return pinnedCurrency
    ? { kind: 'currency', code: pinnedCurrency }
    : DEFAULT_AMOUNT_UNIT;
}

/**
 * The unit of the process's budget field, or `undefined` when the template
 * collects no budget at all.
 */
export function getTemplateBudgetUnit(
  template: ProposalTemplateSchema | null | undefined,
): AmountUnit | undefined {
  if (!templateCollectsBudget(template)) {
    return undefined;
  }

  return getFieldUnit(template?.properties?.budget);
}

/**
 * A stored budget value read as an amount in `unit`, or `null` when it can't
 * be read as one.
 *
 * A value carrying no `currency` makes no claim about its unit and adopts the
 * template's. A value whose `currency` disagrees with `unit` — including any
 * currency at all under a custom-kind unit — is left over from a template
 * that has since been re-pinned, so it is unresolvable rather than silently
 * recounted in the new unit. Callers decide what that means; voting treats it
 * as costing nothing.
 */
export function resolveUnitAmount(
  value: unknown,
  unit: AmountUnit,
): UnitAmount | null {
  const parsed = normalizeBudget(value);

  if (!parsed || !Number.isFinite(parsed.amount)) {
    return null;
  }

  if (
    parsed.currency !== undefined &&
    !isSameUnit({ kind: 'currency', code: parsed.currency }, unit)
  ) {
    return null;
  }

  return { amount: parsed.amount, unit };
}

/**
 * A stored budget shaped for AJV validation against `template`.
 *
 * Storage makes `currency` optional while a currency-kind template may still
 * declare `required: ['amount', 'currency']`, so the code is stamped back in
 * before validation; a custom-kind template declares no `currency` property
 * at all, so a leftover one is dropped rather than failing
 * `additionalProperties`.
 */
export function normalizeBudgetForTemplate(
  value: BudgetData | null | undefined,
  template: ProposalTemplateSchema,
): BudgetData | null | undefined {
  const unit = getTemplateBudgetUnit(template);

  if (!value || !unit) {
    return value;
  }

  if (unit.kind === 'custom') {
    return { amount: value.amount };
  }

  return value.currency === undefined
    ? { ...value, currency: unit.code }
    : value;
}

/** The affix an amount in this unit reads with — `$`, `€`, `points`. */
export function getUnitLabel(unit: AmountUnit): string {
  return unit.kind === 'currency'
    ? getCurrencySymbol(unit.code)
    : unit.label.trim();
}
