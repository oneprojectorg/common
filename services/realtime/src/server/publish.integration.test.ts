import { Channels } from '@op/common/realtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type RealtimeHandler, RealtimeManager } from '../client/manager';
import type { RealtimeMessage } from '../schemas';
import { realtime } from './service';

/**
 * End-to-end check that `RealtimeService.publishMany` actually delivers to
 * every channel it was given, against a real Supabase broadcast endpoint.
 *
 * The unit tests mock `fetch`, so they can only assert the shape of the
 * requests we send — they cannot catch Supabase accepting a request and
 * delivering nothing. That failure would be silent in production
 * (`publishMany` swallows errors by design), so it has to be verified against
 * a real endpoint. An earlier version of this suite is what caught Supabase
 * rejecting oversized multi-topic batches with a 429.
 *
 * Runs against the local Supabase on 127.0.0.1:55321 that `vitest.config.ts`
 * points at, and that CI starts for the Tests job.
 */

const TEST_SUPABASE_URL = process.env.SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!;

/** How long to let a websocket subscription settle before publishing. */
const SUBSCRIBE_SETTLE_MS = 1_000;
/** How long to wait for a broadcast to arrive before calling it lost. */
const DELIVERY_TIMEOUT_MS = 5_000;

function resetRealtimeManager() {
  const manager = RealtimeManager.getInstance();
  const disconnect = Reflect.get(manager, 'disconnect');

  if (typeof disconnect === 'function') {
    disconnect.call(manager);
  }

  Reflect.set(RealtimeManager, 'instance', null);
}

const rejectAfter = (ms: number) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Message timeout')), ms),
  );

describe('RealtimeService.publishMany (integration)', () => {
  beforeEach(() => {
    resetRealtimeManager();
  });

  afterEach(() => {
    resetRealtimeManager();
  });

  it('delivers to every channel in the fan-out', async () => {
    // Deliberately mixed scopes: routing must be per-channel, and the repeated
    // channel must be deduped without dropping the delivery.
    const channelA = Channels.org('fanout-a');
    const channelB = Channels.org('fanout-b');
    const channelC = Channels.user('fanout-c');

    RealtimeManager.initialize({
      supabaseUrl: TEST_SUPABASE_URL,
      supabaseAnonKey: TEST_SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    const received = (channel: Parameters<typeof manager.subscribe>[0]) =>
      new Promise<RealtimeMessage>((resolve) => {
        const handler: RealtimeHandler = ({ data }) => resolve(data);
        manager.subscribe(channel, handler);
      });

    const onA = received(channelA);
    const onB = received(channelB);
    const onC = received(channelC);

    await new Promise((resolve) => setTimeout(resolve, SUBSCRIBE_SETTLE_MS));

    const testMessage: RealtimeMessage = { mutationId: 'fanout-1' };

    await realtime.publishMany(
      [channelA, channelB, channelC, channelA],
      testMessage,
    );

    const results = await Promise.race([
      Promise.all([onA, onB, onC]),
      rejectAfter(DELIVERY_TIMEOUT_MS),
    ]);

    expect(results).toEqual([testMessage, testMessage, testMessage]);
  });

  it('delivers a fan-out far wider than the old batch ceiling', async () => {
    // 120 channels. The previous multi-topic batching would have needed
    // chunking here — Supabase 429s a single request of 92+ messages — and a
    // mis-set chunk cap silently lost *every* invalidation in the batch. One
    // request per channel has no such ceiling; this pins that down.
    const channelA = Channels.org('wide-first');
    const channelB = Channels.org('wide-last');

    RealtimeManager.initialize({
      supabaseUrl: TEST_SUPABASE_URL,
      supabaseAnonKey: TEST_SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    const onA = new Promise<RealtimeMessage>((resolve) => {
      manager.subscribe(channelA, ({ data }) => resolve(data));
    });
    const onB = new Promise<RealtimeMessage>((resolve) => {
      manager.subscribe(channelB, ({ data }) => resolve(data));
    });

    await new Promise((resolve) => setTimeout(resolve, SUBSCRIBE_SETTLE_MS));

    const testMessage: RealtimeMessage = { mutationId: 'wide-1' };

    const filler = Array.from({ length: 118 }, (_, i) =>
      Channels.org(`wide-filler-${i}`),
    );

    // The two subscribed channels sit at either end of the fan-out, so a
    // truncated or short-circuited publish fails the timeout instead of
    // passing.
    await realtime.publishMany([channelA, ...filler, channelB], testMessage);

    const results = await Promise.race([
      Promise.all([onA, onB]),
      rejectAfter(DELIVERY_TIMEOUT_MS),
    ]);

    expect(results).toEqual([testMessage, testMessage]);
  });
});
