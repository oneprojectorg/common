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
  const manager = RealtimeManager.getInstance() as RealtimeManager & {
    disconnect: () => void;
  };

  manager.disconnect();
  (RealtimeManager as { instance: RealtimeManager | null }).instance = null;
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
});
