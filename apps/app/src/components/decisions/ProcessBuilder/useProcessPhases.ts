'use client';

import { trpc } from '@op/api/client';
import { isReviewPhase } from '@op/common/client';
import { useMemo } from 'react';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

export interface ProcessPhase {
  phaseId: string;
  name: string;
  isReview: boolean;
}

export function useProcessPhases(
  instanceId: string,
  decisionProfileId?: string,
): ProcessPhase[] {
  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId },
    { enabled: !!instanceId },
  );

  return useMemo(() => {
    if (storePhases?.length) {
      return storePhases.map((p) => ({
        phaseId: p.phaseId,
        name: p.name ?? '',
        isReview: isReviewPhase(p),
      }));
    }
    const instancePhases = instance?.instanceData?.phases;
    if (instancePhases?.length) {
      return instancePhases.map((p) => ({
        phaseId: p.phaseId,
        name: p.name ?? '',
        isReview: isReviewPhase(p),
      }));
    }
    const templatePhases = instance?.process?.processSchema?.phases;
    if (templatePhases?.length) {
      return templatePhases.map((p) => ({
        phaseId: p.id,
        name: p.name ?? '',
        isReview: isReviewPhase(p),
      }));
    }
    return [];
  }, [storePhases, instance]);
}
