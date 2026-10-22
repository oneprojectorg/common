import { formatCurrency } from '@/utils/formatting';
import {
  type BudgetInput,
  DEFAULT_MONEY_CURRENCY,
  type MoneyAmount,
  normalizeBudget,
} from '@op/common/client';

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
 * A selection's awarded amount as money. `allocated` is a bare numeric, which
 * the budget parser would read as legacy USD; the award is made in the
 * proposal's own budget currency.
 */
export function getAllocatedAmount({
  allocated,
  budget,
}: {
  allocated: string;
  budget: BudgetInput;
}): MoneyAmount {
  return { amount: Number(allocated), currency: getBudgetCurrency(budget) };
}

/** The currency a proposal is funded in: its budget's, else the default. */
export function getBudgetCurrency(budget: BudgetInput): string {
  return normalizeBudget(budget)?.currency ?? DEFAULT_MONEY_CURRENCY;
}
