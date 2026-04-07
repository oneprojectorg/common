'use client';

import { trpc } from '@op/api/client';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

/**
 * Resolves the current `organizeByCategories` setting, preferring the Zustand
 * store value (written synchronously on toggle) over the tRPC query cache
 * (which may lag behind until the next refetch). Defaults to `true` when
 * neither source has a value.
 */
export function useOrganizeByCategories(
  instanceId: string | undefined,
  decisionProfileId: string | undefined,
): boolean {
  const storeValue = useProcessBuilderStore(
    (s) =>
      decisionProfileId
        ? s.instances[decisionProfileId]?.config?.organizeByCategories
        : undefined,
  );

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId: instanceId! },
    { enabled: !!instanceId },
  );

  return (
    storeValue ?? instance?.instanceData?.config?.organizeByCategories ?? true
  );
}
