import { formatCurrency } from '@/utils/formatting';
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
  return formatCurrency(budget.amount, undefined, budget.currency);
}

/**
 * Format a budget value in compact notation (e.g. `$10K`, `$23.7K`). Used where
 * space is tight and the exact figure isn't the point — the awarded badge on
 * results cards. Keeps one fraction digit so non-round amounts stay meaningful.
 */
export function formatBudgetCompact(value: BudgetInput): string | null {
  const budget = normalizeBudget(value);
  if (!budget) {
    return null;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: budget.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(budget.amount);
}
