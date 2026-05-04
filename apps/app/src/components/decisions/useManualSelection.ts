'use client';

import { useCallback, useSyncExternalStore } from 'react';

const KEY_PREFIX = '@op/manual-selection';
const CHANGE_EVENT = '@op/manual-selection:change';

const storageKey = (instanceId: string, phaseId: string) =>
  `${KEY_PREFIX}:${instanceId}:${phaseId}`;

const EMPTY: string[] = [];

// Cache the parsed array per key so useSyncExternalStore's getSnapshot
// returns a stable reference when nothing has changed (required to avoid
// infinite re-renders).
const snapshots = new Map<string, string[]>();

function getSnapshot(key: string): string[] {
  if (typeof window === 'undefined') {
    return EMPTY;
  }

  const cached = snapshots.get(key);
  if (cached) {
    return cached;
  }

  const raw = window.localStorage.getItem(key);
  if (raw === null) {
    snapshots.set(key, EMPTY);
    return EMPTY;
  }

  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
    snapshots.set(key, arr);
    return arr;
  } catch {
    snapshots.set(key, EMPTY);
    return EMPTY;
  }
}

function subscribe(key: string, callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Other tabs writing to this key.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) {
      snapshots.delete(key);
      callback();
    }
  };

  // Same-tab writes (the `storage` event doesn't fire in the originating tab).
  const onChange = (event: Event) => {
    if ((event as CustomEvent<string>).detail === key) {
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

export function useManualSelection(instanceId: string, phaseId: string) {
  const key = storageKey(instanceId, phaseId);

  const proposalIds = useSyncExternalStore(
    useCallback((cb) => subscribe(key, cb), [key]),
    useCallback(() => getSnapshot(key), [key]),
    () => EMPTY,
  );

  const setProposalIds = useCallback(
    (next: string[]) => {
      if (typeof window === 'undefined') {
        return;
      }
      if (next.length === 0) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(next));
      }
      snapshots.delete(key);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
    },
    [key],
  );

  return [proposalIds, setProposalIds] as const;
}
