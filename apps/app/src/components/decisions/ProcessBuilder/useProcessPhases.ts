'use client';
import { useTRPC } from '@op/api/client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

export interface ProcessPhase {
  phaseId: string;
  name: string;
}

export function useProcessPhases(
  instanceId: string,
  decisionProfileId?: string,
): ProcessPhase[] {
  const trpc = useTRPC();
  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const { data: instance } = useQuery(
    trpc.decision.getInstance.queryOptions(
      { instanceId },
      { enabled: !!instanceId },
    ),
  );

  return useMemo(() => {
    if (storePhases?.length) {
      return storePhases.map((p) => ({
        phaseId: p.phaseId,
        name: p.name ?? '',
      }));
    }
    const instancePhases = instance?.instanceData?.phases;
    if (instancePhases?.length) {
      return instancePhases.map((p) => ({
        phaseId: p.phaseId,
        name: p.name ?? '',
      }));
    }
    const templatePhases = instance?.process?.processSchema?.phases;
    if (templatePhases?.length) {
      return templatePhases.map((p) => ({ phaseId: p.id, name: p.name ?? '' }));
    }
    return [];
  }, [storePhases, instance]);
}
