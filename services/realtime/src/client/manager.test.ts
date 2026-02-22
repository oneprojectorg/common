import { Channels } from '@op/common/realtime';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RealtimeMessage } from '../schemas';
import { RealtimeClient } from '../server/client';
import { type RealtimeHandler, RealtimeManager } from './manager';

describe.concurrent('RealtimeManager', () => {
  let realtimeClient: RealtimeClient;
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  beforeAll(() => {
    // Initialize the server client for publishing messages
    realtimeClient = new RealtimeClient({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    });
  });

  afterAll(() => {
    // Clean up any remaining connections
    const manager = RealtimeManager.getInstance();
    // Force disconnect by accessing private method
    (manager as any).disconnect();
  });

  it('should connect, subscribe to a channel, and receive published messages', async () => {
    const TEST_CHANNEL = Channels.org('test-connect');

    // Initialize the RealtimeManager
    RealtimeManager.initialize({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    // Set up a promise to wait for the message
    const messagePromise = new Promise<RealtimeMessage>((resolve) => {
      const handler: RealtimeHandler = ({ data }) => {
        resolve(data);
      };

      // Subscribe to the channel
      manager.subscribe(TEST_CHANNEL, handler);
    });

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Publish a test message using the server client
    const testMessage: RealtimeMessage = { mutationId: 'test-mutation-1' };

    await realtimeClient.publish({
      channel: TEST_CHANNEL,
      data: testMessage,
    });

    // Wait for the message to be received (with timeout)
    const receivedMessage = await Promise.race([
      messagePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Message timeout')), 5000),
      ),
    ]);

    // Verify the received message
    expect(receivedMessage).toEqual(testMessage);
  });

  it('should deliver messages to multiple subscribers on the same channel', async () => {
    const TEST_CHANNEL = Channels.org('test-multiple-subscribers');

    // Reset the singleton
    (RealtimeManager as any).instance = null;

    // Initialize the RealtimeManager
    RealtimeManager.initialize({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });

    const manager = RealtimeManager.getInstance();

    // Create three separate handlers
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

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Publish a test message
    const testMessage: RealtimeMessage = { mutationId: 'test-mutation-3' };

    await realtimeClient.publish({
      channel: TEST_CHANNEL,
      data: testMessage,
    });

    // Wait for all handlers to receive the message
    const results = await Promise.race([
      Promise.all([handler1Promise, handler2Promise, handler3Promise]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Message timeout')), 5000),
      ),
    ]);

    // Verify all three handlers received the same message
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(testMessage);
    expect(results[1]).toEqual(testMessage);
    expect(results[2]).toEqual(testMessage);
    expect(receivedMessages).toHaveLength(3);

    // All received messages should be identical
    receivedMessages.forEach((msg) => {
      expect(msg).toEqual(testMessage);
    });
  });
});
