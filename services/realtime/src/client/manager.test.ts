import { Channels } from '@op/common/realtime';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { RealtimeMessage } from '../schemas';
import { RealtimeClient } from '../server/client';
import { type RealtimeHandler, RealtimeManager } from './manager';

const TEST_SUPABASE_URL = process.env.SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!;
const TEST_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;

function resetRealtimeManager() {
  const manager = RealtimeManager.getInstance();
  const disconnect = Reflect.get(manager, 'disconnect');

  if (typeof disconnect === 'function') {
    disconnect.call(manager);
  }

  Reflect.set(RealtimeManager, 'instance', null);
}

describe('RealtimeManager', () => {
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

  it('should connect, subscribe to a channel, and receive published messages', async () => {
    const TEST_CHANNEL = Channels.org('test-connect');

    RealtimeManager.initialize({
      supabaseUrl: TEST_SUPABASE_URL,
      supabaseAnonKey: TEST_SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    // Set up a promise to wait for the message
    const messagePromise = new Promise<RealtimeMessage>((resolve) => {
      const handler: RealtimeHandler = ({ data }) => {
        resolve(data);
      };

      manager.subscribe(TEST_CHANNEL, handler);
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const testMessage: RealtimeMessage = { mutationId: 'test-mutation-1' };

    await realtimeClient.publish({
      channel: TEST_CHANNEL,
      data: testMessage,
    });

    const receivedMessage = await Promise.race([
      messagePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Message timeout')), 5000),
      ),
    ]);

    expect(receivedMessage).toEqual(testMessage);
  });

  it('should deliver messages to multiple subscribers on the same channel', async () => {
    const TEST_CHANNEL = Channels.org('test-multiple-subscribers');

    RealtimeManager.initialize({
      supabaseUrl: TEST_SUPABASE_URL,
      supabaseAnonKey: TEST_SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    const receivedMessages: RealtimeMessage[] = [];

    const handler1Promise = new Promise<RealtimeMessage>((resolve) => {
      const handler: RealtimeHandler = ({ data }) => {
        receivedMessages.push(data);
        resolve(data);
      };
      manager.subscribe(TEST_CHANNEL, handler);
    });

    const handler2Promise = new Promise<RealtimeMessage>((resolve) => {
      const handler: RealtimeHandler = ({ data }) => {
        receivedMessages.push(data);
        resolve(data);
      };
      manager.subscribe(TEST_CHANNEL, handler);
    });

    const handler3Promise = new Promise<RealtimeMessage>((resolve) => {
      const handler: RealtimeHandler = ({ data }) => {
        receivedMessages.push(data);
        resolve(data);
      };
      manager.subscribe(TEST_CHANNEL, handler);
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const testMessage: RealtimeMessage = { mutationId: 'test-mutation-3' };

    await realtimeClient.publish({
      channel: TEST_CHANNEL,
      data: testMessage,
    });

    const results = await Promise.race([
      Promise.all([handler1Promise, handler2Promise, handler3Promise]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Message timeout')), 5000),
      ),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(testMessage);
    expect(results[1]).toEqual(testMessage);
    expect(results[2]).toEqual(testMessage);
    expect(receivedMessages).toHaveLength(3);

    receivedMessages.forEach((msg) => {
      expect(msg).toEqual(testMessage);
    });
  });

  // Broadcasts are not replayed, so anything published before the socket join
  // completes is lost. Callers waiting on a background job that can finish first
  // rely on this callback to know when it is finally safe to stop guessing and
  // re-read. Firing it early — or not at all — reintroduces the very gap it
  // exists to close.
  it('reports a channel as subscribed only once its join has completed', async () => {
    const TEST_CHANNEL = Channels.org('test-on-subscribed');

    RealtimeManager.initialize({
      supabaseUrl: TEST_SUPABASE_URL,
      supabaseAnonKey: TEST_SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    let subscribedAt: number | null = null;
    const subscribedPromise = new Promise<void>((resolve) => {
      manager.subscribe(
        TEST_CHANNEL,
        () => {},
        () => {
          subscribedAt = Date.now();
          resolve();
        },
      );
    });

    // Not synchronous with subscribe(): the join is a round trip.
    expect(subscribedAt).toBeNull();

    await Promise.race([
      subscribedPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Subscribe timeout')), 5000),
      ),
    ]);

    expect(subscribedAt).not.toBeNull();

    // A message published after the callback must actually arrive — that is the
    // guarantee the callback is standing in for.
    const messagePromise = new Promise<RealtimeMessage>((resolve) => {
      manager.subscribe(TEST_CHANNEL, ({ data }) => resolve(data));
    });

    const testMessage: RealtimeMessage = { mutationId: 'test-after-subscribe' };
    await realtimeClient.publish({ channel: TEST_CHANNEL, data: testMessage });

    await expect(
      Promise.race([
        messagePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Message timeout')), 5000),
        ),
      ]),
    ).resolves.toEqual(testMessage);
  });

  // A second caller joins a channel whose socket is already open, so the status
  // callback driving the first notification has already fired and will not fire
  // again. Without the immediate call it would wait for an event that can never
  // come.
  it('reports an already-joined channel as subscribed immediately', async () => {
    const TEST_CHANNEL = Channels.org('test-already-subscribed');

    RealtimeManager.initialize({
      supabaseUrl: TEST_SUPABASE_URL,
      supabaseAnonKey: TEST_SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    await Promise.race([
      new Promise<void>((resolve) => {
        manager.subscribe(TEST_CHANNEL, () => {}, resolve);
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Subscribe timeout')), 5000),
      ),
    ]);

    let secondCallbackFired = false;
    manager.subscribe(
      TEST_CHANNEL,
      () => {},
      () => {
        secondCallbackFired = true;
      },
    );

    expect(secondCallbackFired).toBe(true);
  });
});
