'use client';

import { useEffect, useRef } from 'react';

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
 * on top — but only for keys that have a defined, non-empty value. This
 * prevents stale localStorage entries (e.g. an empty string from a cleared
 * field in a previous session) from overwriting fresh server data.
 */
export function ProcessBuilderStoreInitializer({
  decisionProfileId,
  serverData,
}: {
  decisionProfileId: string;
  serverData: FormInstanceData;
}) {
  const serverDataRef = useRef(serverData);
  serverDataRef.current = serverData;

  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      const existing =
        useProcessBuilderStore.getState().instances[decisionProfileId];

      const base = serverDataRef.current;

      // Only overlay localStorage values that are defined and non-empty.
      // This prevents stale empty strings or undefined keys from
      // clobbering valid server data.
      const merged: FormInstanceData = { ...base };
      if (existing) {
        for (const [key, value] of Object.entries(existing)) {
          if (value !== undefined && value !== '') {
            (merged as Record<string, unknown>)[key] = value;
          }
        }
      }

      useProcessBuilderStore
        .getState()
        .setInstanceData(decisionProfileId, merged);
    });

    void useProcessBuilderStore.persist.rehydrate();
    return unsubscribe;
  }, [decisionProfileId]);

  return null;
}
