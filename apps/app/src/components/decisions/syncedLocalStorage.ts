'use client';

import { useCallback, useSyncExternalStore } from 'react';

const CHANGE_EVENT = '@op/synced-local-storage:change';

export type SyncedSetter<T> = (next: T | ((prev: T) => T)) => void;

export function createSyncedLocalStorage<T>({
  empty,
  parse,
  serialize,
}: {
  empty: T;
  parse: (raw: string) => T;
  serialize: (value: T) => string | null;
}) {
  // Cache the parsed value per key so useSyncExternalStore's getSnapshot
  // returns a stable reference when nothing has changed (required to avoid
  // infinite re-renders).
  const snapshots = new Map<string, T>();

  const readItem = (key: string): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const writeItem = (key: string, value: T): void => {
    try {
      const raw = serialize(value);
      if (raw === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, raw);
      }
    } catch {}
  };

  function getSnapshot(key: string): T {
    if (typeof window === 'undefined') {
      return empty;
    }
    if (snapshots.has(key)) {
      return snapshots.get(key) ?? empty;
    }
    const raw = readItem(key);
    let value = empty;
    if (raw !== null) {
      try {
        value = parse(raw);
      } catch {}
    }
    snapshots.set(key, value);
    return value;
  }

  function subscribe(key: string, callback: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }
    snapshots.delete(key);
    // Other tabs writing to this key; `null` is another tab clearing storage.
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        snapshots.delete(key);
        callback();
      }
    };
    // Same-tab writes (the `storage` event doesn't fire in the originating tab).
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

  const isUpdater = (next: T | ((prev: T) => T)): next is (prev: T) => T =>
    typeof next === 'function';

  return function useSyncedLocalStorage(
    key: string,
  ): readonly [T, SyncedSetter<T>] {
    const value = useSyncExternalStore(
      useCallback((cb) => subscribe(key, cb), [key]),
      useCallback(() => getSnapshot(key), [key]),
      () => empty,
    );

    const setValue = useCallback<SyncedSetter<T>>(
      (next) => {
        if (typeof window === 'undefined') {
          return;
        }
        const resolved = isUpdater(next) ? next(getSnapshot(key)) : next;
        writeItem(key, resolved);
        snapshots.set(key, resolved);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
      },
      [key],
    );

    return [value, setValue];
  };
}
