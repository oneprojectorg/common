'use client';

import { useRef } from 'react';

import {
  type ProcessBuilderInstanceData,
  useProcessBuilderStore,
} from './stores/useProcessBuilderStore';

/**
 * Seeds the Zustand store with server-fetched instance data. Rendered
 * before the editor sections, and seeds during render (guarded by a ref)
 * so every later sibling sees the data on its first render — no
 * hydration gate or skeleton needed.
 *
 * Server data is the base; the user's own unsaved edits (`dirty`)
 * overlay on top. Safe because `dirty` only ever holds unsaved or
 * failed edits — confirmed saves remove their fields from it.
 */
export function ProcessBuilderStoreInitializer({
  decisionProfileId,
  serverData,
}: {
  decisionProfileId: string;
  serverData: ProcessBuilderInstanceData;
}) {
  const seededFor = useRef<string | null>(null);

  if (seededFor.current !== decisionProfileId) {
    seededFor.current = decisionProfileId;

    const store = useProcessBuilderStore.getState();
    const dirtyFields = store.dirty[decisionProfileId];
    store.seedInstance(decisionProfileId, {
      ...serverData,
      ...dirtyFields,
      config: { ...serverData.config, ...dirtyFields?.config },
    });
  }

  return null;
}
