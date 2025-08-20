import {
  calculateDaysRemaining,
  formatCurrency,
  formatDateRange,
} from '@/utils/formatting';
import type { processPhaseSchema } from '@op/api/encoders';
import { Surface } from '@op/ui/Surface';
import { useLocale } from 'next-intl';
import type { z } from 'zod';

type ProcessPhase = z.infer<typeof processPhaseSchema>;

interface CurrentPhaseSurfaceProps {
  currentPhase?: ProcessPhase;
  budget?: number;
  proposalCount: number;
}

export function CurrentPhaseSurface({
  currentPhase,
  budget,
  proposalCount,
}: CurrentPhaseSurfaceProps) {
  const locale = useLocale();

  const remainingDays = calculateDaysRemaining(currentPhase?.phase?.endDate);

  return (
    <Surface variant="filled" className="flex flex-col gap-4">
      {/* Header section */}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-normal uppercase tracking-[0.96px] text-neutral-gray4">
          Current Phase
        </div>
        <div className="text-sm font-bold leading-[1.5] text-neutral-black">
          {currentPhase?.name || 'Proposal Submissions'}
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
        <div className="flex items-start justify-between text-sm font-normal leading-[1.5]">
          <span className="text-neutral-charcoal">Total Budget</span>
          <span className="text-neutral-black">
            {budget ? formatCurrency(budget, locale) : '$0'}
          </span>
        </div>
        <div className="flex items-start justify-between text-sm font-normal leading-[1.5]">
          <span className="text-neutral-charcoal">Proposals Submitted</span>
          <span className="text-neutral-black">{proposalCount}</span>
        </div>
        {remainingDays !== null && (
          <div className="flex items-start justify-between text-sm font-normal leading-[1.5]">
            <span className="text-neutral-charcoal">Days Remaining</span>
            <span className="text-neutral-black">{remainingDays}</span>
          </div>
        )}
      </div>
    </Surface>
  );
}
