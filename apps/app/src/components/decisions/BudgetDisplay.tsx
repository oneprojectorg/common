import { formatMoney } from '@/utils/formatting';
import { type BudgetInput, normalizeBudget } from '@op/common/client';

export type BudgetDisplayProps = {
  value: BudgetInput;
  /**
   * Currency for a `value` that carries none — a bare number or numeric
   * string, which `normalizeBudget` would otherwise stamp USD onto.
   *
   * Allocated amounts are stored as bare numbers, so without this an allocation
   * renders "$5,000" beside the "€5,000 requested" it was allocated against.
   * Pass the currency of the budget it sits next to.
   */
  fallbackCurrency?: string;
  className?: string;
};

export function BudgetDisplay({
  value,
  fallbackCurrency,
  className,
}: BudgetDisplayProps) {
  const formatted = formatBudget(value, fallbackCurrency);
  if (formatted === null) {
    return null;
  }
  return <span className={className}>{formatted}</span>;
}

/**
 * Format a budget value to a display string. Used when the formatted value
 * needs to be embedded in a translation or otherwise composed inline.
 *
 * See {@link BudgetDisplayProps.fallbackCurrency} — it applies only to values
 * that name no currency of their own, never overriding a stored one.
 */
export function formatBudget(
  value: BudgetInput,
  fallbackCurrency?: string,
): string | null {
  const budget = normalizeBudget(value);
  if (!budget) {
    return null;
  }
  return formatMoney(
    fallbackCurrency && !hasExplicitCurrency(value)
      ? { ...budget, currency: fallbackCurrency }
      : budget,
  );
}

/** Whether the raw input named a currency, vs. having USD stamped on by `normalizeBudget`. */
function hasExplicitCurrency(value: BudgetInput): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'currency' in value &&
    typeof value.currency === 'string' &&
    value.currency.length > 0
  );
}
