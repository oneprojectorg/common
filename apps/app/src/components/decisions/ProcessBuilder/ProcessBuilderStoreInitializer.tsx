'use client';

import { useEffect, useRef } from 'react';

import {
  type ProcessBuilderInstanceData,
  useProcessBuilderStore,
} from './stores/useProcessBuilderStore';

/**
 * Seeds the Zustand store with server-fetched instance data so that
 * validation (and other consumers) have data immediately — even before
 * the user visits any individual section.
 *
 * Merge strategy depends on instance status:
 * - Draft: server data is used directly (localStorage is ignored to avoid
 *   stale edits overwriting already-saved data).
 * - Non-draft: server data is the base layer, localStorage edits overlay
 *   on top for keys with a defined, non-empty value (since not all fields
 *   are persisted to the API yet).
 *
 * Note: `isDraft` is evaluated once from the server component at page load.
 * This assumes launching a process triggers a navigation/reload so the
 * value cannot go stale during a session.
 */
export function ProcessBuilderStoreInitializer({
  decisionProfileId,
  serverData,
  isDraft,
}: {
  decisionProfileId: string;
  serverData: ProcessBuilderInstanceData;
  isDraft: boolean;
}) {
  const serverDataRef = useRef(serverData);
  serverDataRef.current = serverData;

  // Guard against re-seeding when other components call rehydrate(),
  // which re-fires all onFinishHydration listeners. Without this,
  // navigating between sections would overwrite user edits with stale
  // server data from the initial page load.
  const hasSeeded = useRef(false);

  useEffect(() => {
    hasSeeded.current = false;

    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      if (hasSeeded.current) {
        return;
      }
      hasSeeded.current = true;

      const existing =
        useProcessBuilderStore.getState().instances[decisionProfileId];

      const base = serverDataRef.current;

      // For drafts, prefer server data — localStorage may contain stale
      // edits from a previous session that have already been saved.
      // For non-draft (launched) processes, overlay localStorage on top
      // since not all fields are persisted to the API yet.
      let data: ProcessBuilderInstanceData;
      if (isDraft) {
        data = base;
      } else {
        data = { ...base };
        if (existing) {
          for (const [key, value] of Object.entries(existing)) {
            if (key === 'config') {
              data.config = { ...data.config, ...(value as typeof data.config) };
            } else if (value !== undefined && value !== '') {
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
  }, [decisionProfileId, isDraft]);

  return null;
}
