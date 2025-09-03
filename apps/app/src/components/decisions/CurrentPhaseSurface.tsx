'use client';

import {
  calculateDaysRemaining,
  formatCurrency,
  formatDateRange,
} from '@/utils/formatting';
import type { processPhaseSchema } from '@op/api/encoders';
import { Surface } from '@op/ui/Surface';
import { useLocale } from 'next-intl';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

type ProcessPhase = z.infer<typeof processPhaseSchema>;

interface CurrentPhaseSurfaceProps {
  currentPhase?: ProcessPhase;
  budget?: number;
  hideBudget?: boolean;
  proposalCount: number;
}

export function CurrentPhaseSurface({
  currentPhase,
  budget,
  hideBudget,
  proposalCount,
}: CurrentPhaseSurfaceProps) {
  const locale = useLocale();
  const t = useTranslations();

  const remainingDays = calculateDaysRemaining(currentPhase?.phase?.endDate);

  return (
    <Surface variant="filled" className="flex flex-col gap-4 p-4">
      {/* Header section */}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-normal uppercase tracking-[0.96px] text-neutral-gray4">
          {t('Current Phase')}
        </div>
        <div className="text-sm font-bold leading-[1.5] text-neutral-black">
          {currentPhase?.name || t('Proposal Submissions')}
        </div>
        {(currentPhase?.phase?.startDate || currentPhase?.phase?.endDate) && (
          <div className="text-sm font-normal leading-[1.5] text-neutral-black">
            {formatDateRange(
              currentPhase.phase?.startDate,
              currentPhase.phase?.endDate,
              locale,
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-neutral-gray1" />

      {/* Stats section */}
      <div className="flex flex-col gap-2">
        {budget && !hideBudget && (
          <div className="flex items-start justify-between text-sm font-normal leading-[1.5]">
            <span className="text-neutral-charcoal">{t('Total Budget')}</span>
            <span className="text-neutral-black">
              {formatCurrency(budget, locale)}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between text-sm font-normal leading-[1.5]">
          <span className="text-neutral-charcoal">{t('Proposals Submitted')}</span>
          <span className="text-neutral-black">{proposalCount}</span>
        </div>
        {remainingDays !== null && (
          <div className="flex items-start justify-between text-sm font-normal leading-[1.5]">
            <span className="text-neutral-charcoal">{t('Days Remaining')}</span>
            <span className="text-neutral-black">{remainingDays}</span>
          </div>
        )}
      </div>
    </Surface>
  );
}
