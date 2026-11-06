'use client';

import { ballotReceiptSchema } from '@op/common/client';
import { logger } from '@op/logging/client';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * The receipt `submitVote` returns is the only key to the voter's ballot: the
 * server keeps its hash and no link from the voter to the ballot. It lives in
 * this browser only, so another device shows that the voter voted but not
 * what they chose.
 */
const KEY_PREFIX = '@op/ballot-receipt';
const CHANGE_EVENT = '@op/ballot-receipt:change';

const storageKey = (instanceId: string) => `${KEY_PREFIX}:${instanceId}`;

export function useBallotReceipt(instanceId: string): string | undefined {
  const key = storageKey(instanceId);

  const subscribe = useCallback(
    (callback: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) {
          callback();
        }
      };
      // The `storage` event doesn't fire in the tab that wrote the value.
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
    },
    [key],
  );

  return useSyncExternalStore(
    subscribe,
    () => readReceipt(key),
    () => undefined,
  );
}

export function saveBallotReceipt({
  instanceId,
  receipt,
}: {
  instanceId: string;
  receipt: string;
}) {
  const key = storageKey(instanceId);

  try {
    window.localStorage.setItem(key, receipt);
  } catch (error) {
    // Storage can be blocked or full; the vote is cast either way, and only
    // this browser's view of the ballot is lost.
    logger.warn('Could not store the ballot receipt', { error });
    return;
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}

function readReceipt(key: string): string | undefined {
  try {
    const parsed = ballotReceiptSchema.safeParse(
      window.localStorage.getItem(key),
    );

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
