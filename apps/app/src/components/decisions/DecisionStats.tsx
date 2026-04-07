'use client';

import { formatCurrency, formatDateRange } from '@/utils/formatting';
import { type ProcessPhase } from '@op/api/encoders';
import { useLocale } from 'next-intl';

import { useTranslations } from '@/lib/i18n';

interface DecisionStatsProps {
  currentPhase?: ProcessPhase;
  budget?: number;
  proposalCount: number;
  daysRemaining?: number | null;
}

export function DecisionStats({
  currentPhase,
  budget,
  proposalCount,
  daysRemaining,
}: DecisionStatsProps) {
  const locale = useLocale();
  const t = useTranslations();
  return (
    <div className="space-y-6">
      {/* Current Phase */}
      <div>
        <h3 className="text-xs font-semibold tracking-wider text-neutral-gray2 uppercase">
          {t('Current Phase')}
        </h3>
        <p className="mt-1 text-lg font-medium text-neutral-charcoal">
          {currentPhase?.name || t('Proposal Submissions')}
        </p>
        {(currentPhase?.phase?.startDate || currentPhase?.phase?.endDate) && (
          <p className="mt-1 text-sm text-neutral-gray3">
            {formatDateRange(
              currentPhase.phase?.startDate,
              currentPhase.phase?.endDate,
              locale,
            ) || t('Timeline not set')}
          </p>
        )}
      </div>

      <div className="h-px w-full bg-neutral-gray1" />

      {/* Stats */}
      <div className="space-y-3">
        {budget && (
          <div className="flex justify-between">
            <span className="text-sm text-neutral-gray3">
              {t('Total Budget')}
            </span>
            <span className="text-sm font-medium text-neutral-charcoal">
              {formatCurrency(budget, locale)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-sm text-neutral-gray3">
            {t('Proposals Submitted')}
          </span>
          <span className="text-sm font-medium text-neutral-charcoal">
            {proposalCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-neutral-gray3">
            {t('Days Remaining')}
          </span>
          <span className="text-sm font-medium text-neutral-charcoal">
            {daysRemaining !== null ? daysRemaining : '14'}
          </span>
        </div>
      </div>
    </div>
  );
}
