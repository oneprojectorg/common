'use client';

import { formatCurrency } from '@/utils/formatting';
import { sumAmounts } from '@op/common/client';
import { SegmentedProgress } from '@op/sense/SegmentedProgress';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { type ProposalAwards, isValidAwardAmount } from '../useProposalAwards';

interface AwardBudgetMeterProps {
  awards: ProposalAwards;
  selectedIds: readonly string[];
  processBudget: number;
  className?: string;
}

/**
 * How much of the process budget the advanced proposals' awards take: a bar
 * with one segment per advanced row and a sentence, both in the destructive
 * colour once the total passes the budget. Renders nothing while the winners'
 * awards cannot be summed (mixed currencies, nothing selected).
 */
export const AwardBudgetMeter = ({
  awards,
  selectedIds,
  processBudget,
  className,
}: AwardBudgetMeterProps) => {
  const t = useTranslations('decisions.review');
  const { total } = awards;

  if (total === null) {
    return null;
  }

  const format = (amount: number) =>
    formatCurrency(amount, undefined, total.currency);
  const awarded = format(total.amount);
  const budget = format(processBudget);
  const summary = t.markup('awardedOfBudget', {
    awarded,
    budget,
    highlight: (chunks) => chunks,
  });

  return (
    <div className={cn('flex w-full min-w-0 items-center gap-4', className)}>
      <SegmentedProgress
        segments={selectedIds.map((id) => {
          const amount = awards.amounts.get(id);
          return { id, value: isValidAwardAmount(amount) ? amount : 0 };
        })}
        max={processBudget}
        aria-label={t('awardBudgetLabel')}
        getAriaValueText={() => summary}
        className={cn(
          'min-w-16 flex-1',
          awards.isOverBudget &&
            '[&_[data-slot=segmented-progress-segment]]:bg-destructive',
        )}
      />
      {/* The running total changes on every keystroke, so only the warning is
          live; the bar's aria-valuetext carries the total on demand. */}
      <p className="flex min-w-0 flex-col text-sm text-muted-foreground tabular-nums">
        <span>
          {t.rich('awardedOfBudget', {
            awarded,
            budget,
            highlight: (chunks: ReactNode) => (
              <span
                className={cn(
                  'font-medium',
                  awards.isOverBudget ? 'text-destructive' : 'text-foreground',
                )}
              >
                {chunks}
              </span>
            ),
          })}
        </span>
        <span
          className={cn('text-destructive', !awards.isOverBudget && 'sr-only')}
          aria-live="polite"
        >
          {awards.isOverBudget
            ? t('overBudgetWarning', {
                amount: format(sumAmounts([total.amount, -processBudget])),
              })
            : ''}
        </span>
      </p>
    </div>
  );
};
