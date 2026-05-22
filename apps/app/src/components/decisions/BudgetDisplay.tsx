import { formatCurrency } from '@/utils/formatting';
import { normalizeBudget } from '@op/common/client';
import { cn } from '@op/ui/utils';

export type BudgetDisplayProps = {
  /**
   * Raw budget value. Accepts canonical `MoneyAmount` shapes, plain numbers,
   * numeric strings, or `null`/`undefined`. Anything that doesn't parse renders
   * as `null`.
   */
  value: unknown;
  /**
   * Currency to use when the input is a bare number/string with no currency
   * context (e.g., an allocation amount drawn from a budget known to be in
   * another currency). Ignored when `value` carries its own currency.
   */
  fallbackCurrency?: string;
  className?: string;
};

/**
 * Renders a single budget value. Today only monetary budgets are supported;
 * if new budget types land (hours, points, etc.) the dispatch lives here.
 */
export function BudgetDisplay({
  value,
  fallbackCurrency = 'USD',
  className,
}: BudgetDisplayProps) {
  const formatted = formatBudget(value, fallbackCurrency);
  if (formatted === null) {
    return null;
  }
  return <span className={cn(className)}>{formatted}</span>;
}

/**
 * Format a budget value to a display string. Used when the formatted value
 * needs to be embedded in a translation or otherwise composed inline.
 */
export function formatBudget(
  value: unknown,
  fallbackCurrency = 'USD',
): string | null {
  const budget = normalizeBudget(value);
  if (!budget) {
    return null;
  }
  // `normalizeBudget` defaults bare numeric inputs to USD; honor the caller's
  // fallback currency in that case so we don't lose context.
  const currency =
    typeof value === 'object' && value !== null
      ? budget.currency
      : fallbackCurrency;
  return formatCurrency(budget.amount, undefined, currency);
}
