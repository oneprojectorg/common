'use client';

import { formatCurrency, formatDateRange } from '@/utils/formatting';
import type { processPhaseSchema } from '@op/api/encoders';
import type { z } from 'zod';

type ProcessPhase = z.infer<typeof processPhaseSchema>;

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
  return (
    <div className="space-y-6">
      {/* Current Phase */}
      <div>
        <h3 className="text-neutral-gray2 text-xs font-semibold uppercase tracking-wider">
          CURRENT PHASE
        </h3>
        <p className="text-neutral-charcoal mt-1 text-lg font-medium">
          {currentPhase?.name || 'Proposal Submissions'}
        </p>
        {currentPhase?.phase && (
          <p className="text-neutral-gray3 mt-1 text-sm">
            {formatDateRange(
              currentPhase.phase.startDate,
              currentPhase.phase.endDate,
            ) || 'Timeline not set'}
          </p>
        )}
      </div>

      <div className="bg-neutral-gray1 h-px w-full" />

      {/* Stats */}
      <div className="space-y-3">
        {budget && (
          <div className="flex justify-between">
            <span className="text-neutral-gray3 text-sm">Total Budget</span>
            <span className="text-neutral-charcoal text-sm font-medium">
              {formatCurrency(budget)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-neutral-gray3 text-sm">
            Proposals Submitted
          </span>
          <span className="text-neutral-charcoal text-sm font-medium">
            {proposalCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-gray3 text-sm">Days Remaining</span>
          <span className="text-neutral-charcoal text-sm font-medium">
            {daysRemaining !== null ? daysRemaining : '14'}
          </span>
        </div>
      </div>
    </div>
  );
}
