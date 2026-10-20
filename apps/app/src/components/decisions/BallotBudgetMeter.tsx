'use client';

import type { Proposal } from '@op/common/client';
import { Progress } from '@op/sense/Progress';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  type BallotBudget,
  formatBallotAmount,
  getBallotTotal,
} from './ballot';

/** How much of the voter budget the ballot spends, as a bar and a sentence. */
export const BallotBudgetMeter = ({
  ballot,
  budget,
  className,
}: {
  ballot: Proposal[];
  budget: BallotBudget;
  className?: string;
}) => {
  const t = useTranslations('decisions.proposals');
  const total = getBallotTotal({ proposals: ballot, budget });
  const allocated = formatBallotAmount({ amount: total, unit: budget.unit });
  const voterBudget = formatBallotAmount({
    amount: budget.voterBudget,
    unit: budget.unit,
  });
  const summary = t('budgetAllocatedSummary', {
    allocated,
    budget: voterBudget,
  });

  return (
    <div className={cn('flex w-full min-w-0 items-center gap-4', className)}>
      <Progress
        value={Math.min(total, budget.voterBudget)}
        max={budget.voterBudget}
        aria-label={t('budgetAllocatedLabel')}
        getAriaValueText={() => summary}
        className="min-w-16 flex-1"
      />
      <p
        className="min-w-0 text-sm text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {t.rich('budgetAllocatedOfTotal', {
          allocated,
          budget: voterBudget,
          highlight: (chunks: ReactNode) => (
            <span className="font-medium text-foreground">{chunks}</span>
          ),
        })}
      </p>
    </div>
  );
};
