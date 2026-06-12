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
 * Server data is the base layer; locally-dirty fields (the user's own
 * unsaved edits) overlay on top. The dirty map only ever holds unsaved
 * or failed edits — draft autosaves remove confirmed-saved fields
 * (see ProcessBuilderAutosaveContext), and published saves clear the
 * whole instance — so the overlay can't shadow other admins' newer
 * server data, while edits whose autosave failed survive a reload.
 */
export function ProcessBuilderStoreInitializer({
  decisionProfileId,
  serverData,
}: {
  decisionProfileId: string;
  serverData: ProcessBuilderInstanceData;
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

      // Overlay the user's own unsaved edits on top of server data.
      const dirtyFields = store.dirty[decisionProfileId];
      const data: ProcessBuilderInstanceData = {
        ...base,
        ...dirtyFields,
        config: { ...base.config, ...dirtyFields?.config },
      };

      store.seedInstance(decisionProfileId, data);
    });

    void useProcessBuilderStore.persist.rehydrate();
    return unsubscribe;
  }, [decisionProfileId]);

  return null;
}
