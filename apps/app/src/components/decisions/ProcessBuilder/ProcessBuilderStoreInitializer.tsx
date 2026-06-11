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
 * - Draft: server data is used directly, and any persisted dirty fields
 *   are discarded — draft edits autosave to the API, so anything still
 *   in localStorage is from an old session and already saved.
 * - Non-draft: server data is the base layer, with locally-dirty fields
 *   (the user's own unsaved edits) overlaid on top. Only fields the user
 *   actually edited are persisted, so server changes made by other
 *   admins are never shadowed by a stale snapshot.
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

      const store = useProcessBuilderStore.getState();
      const base = serverDataRef.current;

      let data: ProcessBuilderInstanceData;
      if (isDraft) {
        data = base;
        store.clearDirty(decisionProfileId);
      } else {
        // Overlay the user's own unsaved edits on top of server data.
        const dirtyFields = store.dirty[decisionProfileId];
        data = {
          ...base,
          ...dirtyFields,
          config: { ...base.config, ...dirtyFields?.config },
        };
      }

      store.seedInstance(decisionProfileId, data);
    });

    void useProcessBuilderStore.persist.rehydrate();
    return unsubscribe;
  }, [decisionProfileId, isDraft]);

  return null;
}
