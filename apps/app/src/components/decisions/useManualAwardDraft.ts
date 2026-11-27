'use client';

import { createSyncedLocalStorage } from './syncedLocalStorage';
import type { AwardDraft, AwardEdits } from './useProposalAwards';

const KEY_PREFIX = '@op/manual-awards';

const storageKey = (instanceId: string, phaseId: string) =>
  `${KEY_PREFIX}:${instanceId}:${phaseId}`;

const EMPTY: AwardEdits = {};

const useSyncedAwardEdits = createSyncedLocalStorage<AwardEdits>({
  empty: EMPTY,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return EMPTY;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number | null] =>
          entry[1] === null || typeof entry[1] === 'number',
      ),
    );
  },
  serialize: (edits) =>
    Object.keys(edits).length === 0 ? null : JSON.stringify(edits),
});

/** Award edits for one visit to the phase; see `useManualSelection`. */
export function useManualAwardDraft(
  instanceId: string,
  phaseId: string,
  visitId?: string | null,
): AwardDraft {
  const key = storageKey(instanceId, phaseId);
  return useSyncedAwardEdits(visitId ? `${key}:${visitId}` : key);
}
