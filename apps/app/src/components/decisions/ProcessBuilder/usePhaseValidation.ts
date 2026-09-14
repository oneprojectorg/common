'use client';
import { useTRPC } from '@op/api/client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { isPhaseValid } from './validation/processBuilderValidation';

export function usePhaseValidation(
  instanceId: string,
  decisionProfileId?: string,
): Record<string, boolean> {
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
    const source = storePhases ?? instance?.instanceData?.phases ?? [];
    return Object.fromEntries(source.map((p) => [p.phaseId, isPhaseValid(p)]));
  }, [storePhases, instance]);
}
