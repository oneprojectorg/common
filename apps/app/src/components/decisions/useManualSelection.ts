'use client';

import {
  type SyncedSetter,
  createSyncedLocalStorage,
} from './syncedLocalStorage';

const KEY_PREFIX = '@op/manual-selection';

const storageKey = (instanceId: string, phaseId: string) =>
  `${KEY_PREFIX}:${instanceId}:${phaseId}`;

const EMPTY: string[] = [];

const useSyncedSelection = createSyncedLocalStorage<string[]>({
  empty: EMPTY,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : EMPTY;
  },
  serialize: (next) => (next.length === 0 ? null : JSON.stringify(next)),
});

/**
 * The draft of proposals to advance. Pass `visitId` (the inbound transition)
 * when the draft belongs to one visit to the phase, so a revert and
 * re-advance starts from a clean draft.
 */
export function useManualSelection(
  instanceId: string,
  phaseId: string,
  visitId?: string | null,
): readonly [string[], SyncedSetter<string[]>] {
  return useSyncedSelection(
    withVisit(storageKey(instanceId, phaseId), visitId),
  );
}

const useSyncedSeeded = createSyncedLocalStorage<boolean>({
  empty: false,
  parse: (raw) => raw === 'true',
  serialize: (next) => (next ? 'true' : null),
});

/**
 * Whether the pipeline's picks were already ticked on this visit to the phase,
 * so an admin who clears them is not handed them again.
 */
export function usePipelinePicksSeeded(
  instanceId: string,
  phaseId: string,
  visitId: string | null | undefined,
): readonly [boolean, SyncedSetter<boolean>] {
  return useSyncedSeeded(
    withVisit(`${KEY_PREFIX}-seeded:${instanceId}:${phaseId}`, visitId),
  );
}

function withVisit(key: string, visitId: string | null | undefined): string {
  return visitId ? `${key}:${visitId}` : key;
}
