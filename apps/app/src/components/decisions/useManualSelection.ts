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

export function useManualSelection(
  instanceId: string,
  phaseId: string,
): readonly [string[], SyncedSetter<string[]>] {
  return useSyncedSelection(storageKey(instanceId, phaseId));
}
