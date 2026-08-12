'use client';

import { formatMoney } from '@/utils/formatting';
import { type BudgetInput, normalizeBudget } from '@op/common/client';
import { cn } from '@op/ui/utils';

import { useTranslations } from '@/lib/i18n';

export type BudgetDisplayProps = {
  value: BudgetInput;
  /**
   * Currency for a `value` that carries none — a bare number or numeric
   * string, which `normalizeBudget` leaves without one.
   *
   * Required, not optional with a default: two review rounds each found a
   * surface that had simply forgotten to pass it and silently rendered dollars
   * on a EUR process. A required prop turns the next omission into a type
   * error. Resolve it with `resolveBudgetFallbackCurrency`; allocated amounts
   * are stored as bare numbers, so pass the currency of the budget they sit
   * beside.
   */
  fallbackCurrency: string;
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
  fallbackCurrency: string,
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

/**
 * An allocated amount rendered as the primary value, with the originally
 * requested budget beside it as a secondary label ("$3,500 requested").
 *
 * Shared by the card and the detail preview, which differ only in the type
 * colour they render the amount in — keeping two copies is how one of them
 * ends up passing the wrong `fallbackCurrency` to only one of its two
 * `BudgetDisplay`s.
 */
export function AllocatedBudgetDisplay({
  allocated,
  requested,
  fallbackCurrency,
  className,
  amountClassName,
}: {
  allocated: BudgetInput;
  requested: BudgetInput;
  /**
   * Applies to both amounts: an allocation is stored as a bare number, and a
   * requested budget that named no currency of its own is denominated in the
   * process's just the same. See {@link BudgetDisplayProps.fallbackCurrency}.
   */
  fallbackCurrency: string;
  className?: string;
  amountClassName?: string;
}) {
  const t = useTranslations();
  const requestedText = formatBudget(requested, fallbackCurrency);

  return (
    <div className={cn('flex flex-wrap items-end gap-2', className)}>
      <BudgetDisplay
        value={allocated}
        fallbackCurrency={fallbackCurrency}
        className={amountClassName}
      />
      {requestedText && (
        <span className="text-sm text-neutral-gray4">
          {t('{amount} requested', { amount: requestedText })}
        </span>
      )}
    </div>
  );
}
