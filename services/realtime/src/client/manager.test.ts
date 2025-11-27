import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { Channels } from '../channels';
import type { RealtimeMessage } from '../schemas';
import { RealtimeClient } from '../server/client';
import { generateConnectionToken } from '../server/token';
import { RealtimeManager } from './manager';

// Make WebSocket available globally for Centrifuge
global.WebSocket = WebSocket as any;

describe('RealtimeManager', () => {
  let realtimeClient: RealtimeClient;
  const TEST_CHANNEL = Channels.global();
  const WS_URL = 'ws://localhost:8000/connection/websocket';
  const API_URL = 'http://localhost:8000/api';
  const API_KEY = process.env.CENTRIFUGO_API_KEY!;
  const TEST_USER_ID = 'test-user-123';

  beforeAll(() => {
    // Initialize the server client for publishing messages
    realtimeClient = new RealtimeClient({
      apiUrl: API_URL,
      apiKey: API_KEY,
    });
  });

  afterAll(() => {
    // Clean up any remaining connections
    const manager = RealtimeManager.getInstance();
    // Force disconnect by accessing private method
    (manager as any).disconnect();
  });

  it('should connect, subscribe to a channel, and receive published messages', async () => {
    // Generate a real token using the token generation function
    const getToken = async () => {
      return generateConnectionToken(TEST_USER_ID);
    };

    // Initialize the RealtimeManager
    RealtimeManager.initialize({
      wsUrl: WS_URL,
      getToken,
    });

    const manager = RealtimeManager.getInstance();

    // Set up a promise to wait for the message
    const messagePromise = new Promise<RealtimeMessage>((resolve) => {
      const handler = (data: RealtimeMessage) => {
        resolve(data);
      };

      // Subscribe to the channel
      manager.subscribe(TEST_CHANNEL, handler);
    });

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Publish a test message using the server client
    const testMessage: RealtimeMessage = {
      type: 'query-invalidation',
      queryKey: ['test', 'key'],
    };

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
    expect(receivedMessage.type).toBe('query-invalidation');
    expect(receivedMessage.queryKey).toEqual(['test', 'key']);
  });

  it.each([
    { token: '', description: 'empty token' },
    { token: 'random-token', description: 'invalid token' },
  ])(
    'should not allow unauthenticated users to connect to channels with $description',
    async ({ token }) => {
      // Create a new instance to avoid interference with other tests
      // Force reset the singleton by accessing private static property
      (RealtimeManager as any).instance = null;

      // Initialize with an invalid/empty token to simulate unauthenticated user
      const getToken = async () => {
        return token;
      };

      RealtimeManager.initialize({
        wsUrl: WS_URL,
        getToken,
      });

      const manager = RealtimeManager.getInstance();

      // Track disconnect reason to verify it's auth-related
      let disconnectReason: any = null;

      const disconnectionPromise = new Promise<boolean>((resolve) => {
        manager.addConnectionListener((isConnected: boolean) => {
          if (!isConnected) {
            resolve(true);
          }
        });

        // If no disconnection happens within 1 second, assume connection might have succeeded
        setTimeout(() => resolve(false), 1000);
      });

      // Trigger connection and hook into centrifuge events immediately
      const messageReceived = new Promise<boolean>((resolve) => {
        const handler = () => {
          resolve(true);
        };

        // Attempt to subscribe - this triggers ensureConnected()
        manager.subscribe(TEST_CHANNEL, handler);

        // Immediately after subscribe, access centrifuge and hook into events
        // Use setTimeout to ensure centrifuge is initialized
        setTimeout(() => {
          const centrifugeInstance = (manager as any).centrifuge;
          if (centrifugeInstance) {
            centrifugeInstance.on('disconnected', (ctx: any) => {
              disconnectReason = ctx;
            });
          }
        }, 0);

        // Set a timer to resolve false if no message is received
        setTimeout(() => resolve(false), 1000);
      });

      // Wait for disconnection or timeout
      const disconnected = await disconnectionPromise;

      // Publish a test message
      const testMessage: RealtimeMessage = {
        type: 'query-invalidation',
        queryKey: ['test', 'unauthenticated'],
      };

      await realtimeClient.publish({
        channel: TEST_CHANNEL,
        data: testMessage,
      });

      // Wait to see if the message is received
      const received = await messageReceived;

      // Verify that either:
      // 1. The connection was never established (disconnected)
      // 2. No message was received (because connection failed)
      expect(disconnected || !received).toBe(true);

      // Verify the disconnect reason indicates authentication failure
      expect(disconnectReason).toBeDefined();
      // Both 3500 (invalid token) and 3501 (bad request) are auth-related errors
      expect([3500, 3501]).toContain(disconnectReason.code);
      expect(disconnectReason.reason).toBeDefined();
    },
  );

  it('should deliver messages to multiple subscribers on the same channel', async () => {
    // Reset the singleton
    (RealtimeManager as any).instance = null;

    // Generate a real token
    const getToken = async () => {
      return generateConnectionToken(TEST_USER_ID);
    };

    // Initialize the RealtimeManager
    RealtimeManager.initialize({
      wsUrl: WS_URL,
      getToken,
    });

    const manager = RealtimeManager.getInstance();

    // Create three separate handlers
    const receivedMessages: RealtimeMessage[] = [];

    const handler1Promise = new Promise<RealtimeMessage>((resolve) => {
      const handler = (data: RealtimeMessage) => {
        receivedMessages.push(data);
        resolve(data);
      };
      manager.subscribe(TEST_CHANNEL, handler);
    });

    const handler2Promise = new Promise<RealtimeMessage>((resolve) => {
      const handler = (data: RealtimeMessage) => {
        receivedMessages.push(data);
        resolve(data);
      };
      manager.subscribe(TEST_CHANNEL, handler);
    });

    const handler3Promise = new Promise<RealtimeMessage>((resolve) => {
      const handler = (data: RealtimeMessage) => {
        receivedMessages.push(data);
        resolve(data);
      };
      manager.subscribe(TEST_CHANNEL, handler);
    });

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Publish a test message
    const testMessage: RealtimeMessage = {
      type: 'query-invalidation',
      queryKey: ['test', 'multiple-subscribers'],
    };

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
