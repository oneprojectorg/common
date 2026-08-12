import { formatMoney } from '@/utils/formatting';
import {
  type BudgetInput,
  DEFAULT_BUDGET_CURRENCY,
  normalizeBudget,
} from '@op/common/client';

export type BudgetDisplayProps = {
  value: BudgetInput;
  /**
   * Currency for a `value` that carries none — a bare number or numeric
   * string, which `normalizeBudget` leaves without one.
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
  fallbackCurrency: string = DEFAULT_BUDGET_CURRENCY,
): string | null {
  const budget = normalizeBudget(value);
  if (!budget) {
    return null;
  }
  // No "did this name a currency?" predicate needed: `normalizeBudget` leaves
  // the currency absent rather than defaulting it, so the value itself already
  // says whether the fallback applies. `||` covers a stored blank code, which
  // names a currency no more than an absent one does.
  return formatMoney({
    amount: budget.amount,
    currency: budget.currency || fallbackCurrency,
  });
}
