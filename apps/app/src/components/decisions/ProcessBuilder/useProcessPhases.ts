'use client';

import { trpc } from '@op/api/client';
import { useMemo } from 'react';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

export interface ProcessPhase {
  phaseId: string;
  name: string;
}

interface NamedPhase {
  name?: string;
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

  return useMemo(
    () =>
      resolveProcessPhases({
        storePhases,
        instancePhases: instance?.instanceData?.phases,
        templatePhases: instance?.process?.processSchema?.phases,
      }),
    [storePhases, instance],
  );
}

export function resolveProcessPhases({
  storePhases,
  instancePhases,
  templatePhases,
}: {
  storePhases?: Array<NamedPhase & { phaseId: string }>;
  instancePhases?: Array<NamedPhase & { phaseId: string }>;
  templatePhases?: Array<NamedPhase & { id: string }>;
}): ProcessPhase[] {
  if (storePhases?.length) {
    return storePhases.map((p) => ({ phaseId: p.phaseId, name: p.name ?? '' }));
  }
  // An empty list is an answer; only an instance without one is still on
  // its template.
  if (instancePhases) {
    return instancePhases.map((p) => ({
      phaseId: p.phaseId,
      name: p.name ?? '',
    }));
  }
  return (templatePhases ?? []).map((p) => ({
    phaseId: p.id,
    name: p.name ?? '',
  }));
}
