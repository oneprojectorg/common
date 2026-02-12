'use client';

import { useEffect } from 'react';

import {
  type FormInstanceData,
  useProcessBuilderStore,
} from './stores/useProcessBuilderStore';

/**
 * Seeds the Zustand store with server-fetched instance data so that
 * validation (and other consumers) have data immediately — even before
 * the user visits any individual section.
 *
 * Merge strategy: server data is the base layer, localStorage edits overlay
 * on top. This preserves in-progress work while filling in any fields the
 * user hasn't touched yet.
 */
export function ProcessBuilderStoreInitializer({
  decisionProfileId,
  serverData,
}: {
  decisionProfileId: string;
  serverData: FormInstanceData;
}) {
  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(
      () => {
        const existing =
          useProcessBuilderStore.getState().instances[decisionProfileId];

        // Server data as base, localStorage edits on top
        const merged = { ...serverData, ...existing };
        useProcessBuilderStore
          .getState()
          .setInstanceData(decisionProfileId, merged);
      },
    );

    void useProcessBuilderStore.persist.rehydrate();
    return unsubscribe;
  }, [decisionProfileId, serverData]);

  return null;
}
