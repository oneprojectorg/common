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
  isDraft,
}: {
  decisionProfileId: string;
  serverData: FormInstanceData;
  isDraft: boolean;
}) {
  const serverDataRef = useRef(serverData);
  serverDataRef.current = serverData;

  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      const existing =
        useProcessBuilderStore.getState().instances[decisionProfileId];

      const base = serverDataRef.current;

      // For drafts, use server data directly — localStorage may contain
      // stale edits from a previous session that have already been saved.
      // For non-draft (launched) processes, overlay localStorage on top
      // since not all fields are persisted to the API yet.
      let data: FormInstanceData;
      if (isDraft) {
        data = base;
      } else {
        data = { ...base };
        if (existing) {
          for (const [key, value] of Object.entries(existing)) {
            if (value !== undefined && value !== '') {
              (data as Record<string, unknown>)[key] = value;
            }
          }
        }
      }

      useProcessBuilderStore
        .getState()
        .setInstanceData(decisionProfileId, data);
    });

    void useProcessBuilderStore.persist.rehydrate();
    return unsubscribe;
  }, [decisionProfileId]);

  return null;
}
