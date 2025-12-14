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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-gray2">
          CURRENT PHASE
        </h3>
        <p className="mt-1 text-lg font-medium text-neutral-charcoal">
          {currentPhase?.name || 'Proposal Submissions'}
        </p>
        {currentPhase?.phase && (
          <p className="mt-1 text-sm text-neutral-gray3">
            {formatDateRange(
              currentPhase.phase.startDate,
              currentPhase.phase.endDate,
            ) || 'Timeline not set'}
          </p>
        )}
      </div>

      <div className="h-px w-full bg-neutral-gray1" />

      {/* Stats */}
      <div className="space-y-3">
        {budget && (
          <div className="flex justify-between">
            <span className="text-sm text-neutral-gray3">Total Budget</span>
            <span className="text-sm font-medium text-neutral-charcoal">
              {formatCurrency(budget)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-sm text-neutral-gray3">
            Proposals Submitted
          </span>
          <span className="text-sm font-medium text-neutral-charcoal">
            {proposalCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-neutral-gray3">Days Remaining</span>
          <span className="text-sm font-medium text-neutral-charcoal">
            {daysRemaining !== null ? daysRemaining : '14'}
          </span>
        </div>
      </div>
    </div>
  );
}
