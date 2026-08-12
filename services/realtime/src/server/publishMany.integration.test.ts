import { Channels } from '@op/common/realtime';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type RealtimeHandler, RealtimeManager } from '../client/manager';
import type { RealtimeMessage } from '../schemas';
import { RealtimeClient } from './client';

/**
 * End-to-end check of the premise this whole batching change rests on: that
 * Supabase Realtime's `/realtime/v1/api/broadcast` accepts a multi-topic
 * `messages` array and fans *each entry to its own topic*.
 *
 * The unit tests in `client.test.ts` mock `fetch`, so they can only assert the
 * shape of the request we send — they cannot catch Supabase accepting the batch
 * and delivering only the first topic. That failure would be silent in
 * production (`RealtimeService.publishMany` swallows errors by design), so it
 * has to be verified against a real broadcast endpoint.
 *
 * Runs against the local Supabase on 127.0.0.1:55321 that `vitest.config.ts`
 * points at, and that CI starts for the Tests job.
 */

const TEST_SUPABASE_URL = process.env.SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!;
const TEST_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

describe('RealtimeClient.publishMany (integration)', () => {
  let realtimeClient: RealtimeClient;

  beforeAll(() => {
    realtimeClient = new RealtimeClient({
      supabaseUrl: TEST_SUPABASE_URL,
      serviceRoleKey: TEST_SUPABASE_SERVICE_ROLE_KEY,
    });
  });

  beforeEach(() => {
    resetRealtimeManager();
  });

  afterEach(() => {
    resetRealtimeManager();
  });

  it('fans one batched request out to every distinct topic', async () => {
    // Deliberately mixed scopes: routing must be per-message, not per-request.
    const channelA = Channels.org('batch-fanout-a');
    const channelB = Channels.org('batch-fanout-b');
    const channelC = Channels.user('batch-fanout-c');

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

    const testMessage: RealtimeMessage = { mutationId: 'batch-fanout-1' };

    // Count real HTTP requests without mocking them away, so this asserts both
    // halves at once: that we send *one* request, and that Supabase fans it
    // out to all three topics.
    const realFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = ((...args: Parameters<typeof realFetch>) => {
      requestCount += 1;
      return realFetch(...args);
    }) as typeof realFetch;

    try {
      await realtimeClient.publishMany({
        messages: [channelA, channelB, channelC].map((channel) => ({
          channel,
          data: testMessage,
        })),
      });
    } finally {
      globalThis.fetch = realFetch;
    }

    const results = await Promise.race([
      Promise.all([onA, onB, onC]),
      rejectAfter(DELIVERY_TIMEOUT_MS),
    ]);

    // Three topics delivered off a single round-trip — the entire point of
    // the change. If Supabase only honoured the first topic, onB/onC would
    // hang and this would fail on the timeout instead.
    expect(requestCount).toBe(1);
    expect(results).toEqual([testMessage, testMessage, testMessage]);
  });

  it('delivers a batch that spans more than one chunk', async () => {
    // Two topics still arrive when they are split across separate requests,
    // so the chunking path is exercised rather than assumed.
    const channelA = Channels.org('batch-chunked-a');
    const channelB = Channels.org('batch-chunked-b');

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

    const testMessage: RealtimeMessage = { mutationId: 'batch-chunked-1' };

    // 60 messages > the 50-per-request cap, so this is 2 requests. The two
    // subscribed topics deliberately straddle the chunk boundary: channelA is
    // the 1st message (chunk 1), channelB the 60th (chunk 2). A single
    // unchunked request of this size would be 429'd by Supabase outright.
    const filler = Array.from({ length: 58 }, (_, i) => ({
      channel: Channels.org(`batch-chunked-filler-${i}`),
      data: testMessage,
    }));

    await realtimeClient.publishMany({
      messages: [
        { channel: channelA, data: testMessage },
        ...filler,
        { channel: channelB, data: testMessage },
      ],
    });

    const results = await Promise.race([
      Promise.all([onA, onB]),
      rejectAfter(DELIVERY_TIMEOUT_MS),
    ]);

    expect(results).toEqual([testMessage, testMessage]);
  });
});
