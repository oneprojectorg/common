'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { AwardDraft, AwardEdits } from './useProposalAwards';

const KEY_PREFIX = '@op/manual-awards';
const CHANGE_EVENT = '@op/manual-awards:change';

const storageKey = (instanceId: string, phaseId: string) =>
  `${KEY_PREFIX}:${instanceId}:${phaseId}`;

const EMPTY: AwardEdits = {};

const snapshots = new Map<string, AwardEdits>();

const parseEdits = (raw: string | null): AwardEdits => {
  if (raw === null) {
    return EMPTY;
  }
  try {
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
  } catch {
    return EMPTY;
  }
};

function getSnapshot(key: string): AwardEdits {
  if (typeof window === 'undefined') {
    return EMPTY;
  }
  const cached = snapshots.get(key);
  if (cached) {
    return cached;
  }
  const edits = parseEdits(window.localStorage.getItem(key));
  snapshots.set(key, edits);
  return edits;
}

function subscribe(key: string, callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  snapshots.delete(key);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      snapshots.delete(key);
      callback();
    }
  };
  const onChange = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === key) {
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useManualAwardDraft(
  instanceId: string,
  phaseId: string,
): AwardDraft {
  const key = storageKey(instanceId, phaseId);

  const edits = useSyncExternalStore(
    useCallback((cb) => subscribe(key, cb), [key]),
    useCallback(() => getSnapshot(key), [key]),
    () => EMPTY,
  );

  const setEdits = useCallback(
    (next: AwardEdits) => {
      if (typeof window === 'undefined') {
        return;
      }
      const isEmpty = Object.keys(next).length === 0;
      if (isEmpty) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(next));
      }
      snapshots.set(key, isEmpty ? EMPTY : next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
    },
    [key],
  );

  return [edits, setEdits];
}
