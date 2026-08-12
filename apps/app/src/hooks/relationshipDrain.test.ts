import { describe, expect, it } from 'vitest';

import {
  type RelationshipDrainIo,
  requestRelationship,
} from './relationshipDrain';

/** A promise plus the handle to settle it, so a test can hold a call in flight. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

/** Runs every pending microtask, so the loop lands on its next await. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * An `io` that records what the drain did.
 *
 * `overlaps` is the load-bearing one: nothing the loop calls may run
 * concurrently with anything else it calls. An entry there means the lease was
 * dropped somewhere and a second drain started racing the first.
 */
function createIo(
  options: {
    send?: (next: boolean) => Promise<void>;
    reconcile?: () => Promise<void>;
  } = {},
) {
  const sends: boolean[] = [];
  const errors: unknown[] = [];
  const overlaps: string[] = [];
  const counts = { reconcile: 0 };
  let active: string | null = null;

  const exclusive = async (label: string, run: () => Promise<void>) => {
    if (active) {
      overlaps.push(`${active} during ${label}`);
    }

    active = label;

    try {
      await run();
    } finally {
      active = null;
    }
  };

  const io: RelationshipDrainIo = {
    send: (next) =>
      exclusive('send', async () => {
        sends.push(next);
        await (options.send?.(next) ?? Promise.resolve());
      }),
    reconcile: () =>
      exclusive('reconcile', async () => {
        counts.reconcile += 1;
        await (options.reconcile?.() ?? Promise.resolve());
      }),
    onError: (error) => errors.push(error),
  };

  return { io, sends, errors, overlaps, counts };
}

describe('requestRelationship', () => {
  it('sends on the first press, with no prior state', async () => {
    const { io, sends, counts, overlaps } = createIo();

    await requestRelationship('cold:likes', true, io);

    expect(sends).toEqual([true]);
    expect(counts.reconcile).toBe(1);
    expect(overlaps).toEqual([]);
  });

  it('collapses a burst that ends where it started to one request', async () => {
    const inFlight = deferred();
    const { io, sends, counts } = createIo({ send: () => inFlight.promise });

    const drain = requestRelationship('odd:likes', true, io);

    // Two more presses while the first request is still in the air.
    void requestRelationship('odd:likes', false, io);
    void requestRelationship('odd:likes', true, io);

    inFlight.resolve();
    await drain;

    expect(sends).toEqual([true]);
    expect(counts.reconcile).toBe(1);
  });

  it('sends one correction when a burst ends on the opposite state', async () => {
    const inFlight = deferred();
    const gates = [inFlight.promise];
    const { io, sends } = createIo({
      send: () => gates.shift() ?? Promise.resolve(),
    });

    const drain = requestRelationship('even:likes', true, io);

    void requestRelationship('even:likes', false, io);

    inFlight.resolve();
    await drain;

    // The sequence, not just the count: it's what proves the loop re-read the
    // intent rather than queueing a request per press.
    expect(sends).toEqual([true, false]);
  });

  it('picks up a press that lands during the reconcile', async () => {
    const inFlight = deferred();
    const gates = [inFlight.promise];
    const { io, sends, counts, overlaps } = createIo({
      reconcile: () => gates.shift() ?? Promise.resolve(),
    });

    const drain = requestRelationship('mid:likes', true, io);

    await flush();

    expect(sends).toEqual([true]);
    expect(counts.reconcile).toBe(1);

    void requestRelationship('mid:likes', false, io);

    inFlight.resolve();
    await drain;

    expect(sends).toEqual([true, false]);
    expect(overlaps).toEqual([]);
  });

  it('ends the burst on a failed write instead of retrying', async () => {
    const boom = new Error('write failed');
    let fail = true;
    const { io, sends, errors, counts } = createIo({
      send: () => (fail ? Promise.reject(boom) : Promise.resolve()),
    });

    await requestRelationship('fail:likes', true, io);

    expect(sends).toEqual([true]);
    expect(errors).toEqual([boom]);
    expect(counts.reconcile).toBe(1);

    // The lease survived the failure, so the next press starts a fresh drain
    // rather than finding the button dead for the rest of the session.
    fail = false;
    await requestRelationship('fail:likes', true, io);

    expect(sends).toEqual([true, true]);
  });

  it('still sends a press that lands during the reconcile after a failure', async () => {
    const boom = new Error('write failed');
    const inFlight = deferred();
    const gates = [inFlight.promise];
    let fail = true;
    const { io, sends, errors } = createIo({
      send: () => {
        const result = fail ? Promise.reject(boom) : Promise.resolve();

        fail = false;

        return result;
      },
      reconcile: () => gates.shift() ?? Promise.resolve(),
    });

    const drain = requestRelationship('failmid:likes', true, io);

    await flush();

    void requestRelationship('failmid:likes', false, io);

    inFlight.resolve();
    await drain;

    // The press was made while the error's reconcile was in flight. Discarding
    // it leaves the cache flipped against the server for the next press to read.
    expect(sends).toEqual([true, false]);
    expect(errors).toEqual([boom]);
  });

  it('drains each key independently', async () => {
    const inFlight = deferred();
    const likes = createIo({ send: () => inFlight.promise });
    const follows = createIo();

    const likesDrain = requestRelationship('split:likes', true, likes.io);

    await requestRelationship('split:following', true, follows.io);

    expect(follows.sends).toEqual([true]);

    inFlight.resolve();
    await likesDrain;

    expect(likes.sends).toEqual([true]);
  });

  it('shares one drain between two mounts of the same proposal', async () => {
    const inFlight = deferred();
    const cardA = createIo({ send: () => inFlight.promise });
    const cardB = createIo();

    const drain = requestRelationship('shared:likes', true, cardA.io);

    // The same proposal, mounted a second time — a card in the list and the
    // detail view, say.
    void requestRelationship('shared:likes', false, cardB.io);

    inFlight.resolve();
    await drain;

    // One drain, two requests: B reversed the target instead of opening a
    // second loop, and the correction went through B's callbacks — the newest.
    expect(cardA.sends).toEqual([true]);
    expect(cardB.sends).toEqual([false]);
    expect(cardA.counts.reconcile).toBe(0);
    expect(cardB.counts.reconcile).toBe(1);
  });
});
