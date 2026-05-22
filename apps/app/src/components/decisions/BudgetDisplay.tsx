import { formatMoney } from '@/utils/formatting';
import { type BudgetInput, normalizeBudget } from '@op/common/client';

export type BudgetDisplayProps = {
  value: BudgetInput;
  className?: string;
};

export function BudgetDisplay({ value, className }: BudgetDisplayProps) {
  const formatted = formatBudget(value);
  if (formatted === null) {
    return null;
  }
  return <span className={className}>{formatted}</span>;
}

/**
 * Format a budget value to a display string. Used when the formatted value
 * needs to be embedded in a translation or otherwise composed inline.
 */
export function formatBudget(value: BudgetInput): string | null {
  const budget = normalizeBudget(value);
  if (!budget) {
    return null;
  }
  return formatMoney(budget);
}
