'use client';

import { useUser } from '@/utils/UserProvider';
import { ballotReceiptSchema } from '@op/common/client';
import { logger } from '@op/logging/client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * The receipt `submitVote` returns is the only key to the voter's ballot: the
 * server keeps values derived from it and no link from the voter to the
 * ballot. It lives in this browser only, so another device shows that the
 * voter voted but not what they chose.
 *
 * Keyed by the voter's profile, so a second account on the same browser
 * never reads the first one's ballot, and cleared on logout.
 */
const KEY_PREFIX = '@op/ballot-receipt';
const CHANGE_EVENT = '@op/ballot-receipt:change';

export type BallotReceiptState =
  /** Storage not read yet: the server render, and the client until hydrated. */
  | { status: 'pending' }
  | { status: 'none' }
  | { status: 'held'; receipt: string };

const PENDING: BallotReceiptState = { status: 'pending' };
const NONE: BallotReceiptState = { status: 'none' };

const storageKey = ({
  profileId,
  instanceId,
}: {
  profileId: string;
  instanceId: string;
}) => `${KEY_PREFIX}:${profileId}:${instanceId}`;

/** The current profile's receipt for `instanceId`, once this browser can say. */
export function useBallotReceipt(instanceId: string): BallotReceiptState {
  const { user } = useUser();
  const profileId = user?.profileId;
  const key = profileId ? storageKey({ profileId, instanceId }) : undefined;

  const subscribe = useCallback(
    (callback: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) {
          callback();
        }
      };
      // The `storage` event doesn't fire in the tab that wrote the value.
      const onChange = (event: Event) => {
        if (
          event instanceof CustomEvent &&
          (event.detail === key || event.detail === null)
        ) {
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

  const receipt = useSyncExternalStore(
    subscribe,
    () => (key ? readReceipt(key) : null),
    () => undefined,
  );

  return useMemo(() => {
    if (receipt === undefined) {
      return PENDING;
    }

    return receipt === null ? NONE : { status: 'held', receipt };
  }, [receipt]);
}

export function saveBallotReceipt({
  profileId,
  instanceId,
  receipt,
}: {
  profileId: string;
  instanceId: string;
  receipt: string;
}) {
  const key = storageKey({ profileId, instanceId });

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

/** Forgets every receipt this browser holds; the next account gets none. */
export function clearBallotReceipts() {
  try {
    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(`${KEY_PREFIX}:`),
    );

    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: null }));
}

/** `null` for none; the hook reserves `undefined` for "not read yet". */
function readReceipt(key: string): string | null {
  try {
    const parsed = ballotReceiptSchema.safeParse(
      window.localStorage.getItem(key),
    );

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
