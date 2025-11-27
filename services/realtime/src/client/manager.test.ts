import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { RealtimeClient } from '../server/client';
import { generateConnectionToken } from '../server/token';
import type { RealtimeMessage } from '../types';
import { RealtimeManager } from './manager';

// Make WebSocket available globally for Centrifuge
global.WebSocket = WebSocket as any;

describe('RealtimeManager', () => {
  let realtimeClient: RealtimeClient;
  const TEST_CHANNEL = 'test-channel';
  const WS_URL =
    'wss://realtime-production-zsndc.ondigitalocean.app/connection/websocket';
  const API_URL = process.env.CENTRIFUGO_API_URL!;
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
    await new Promise((resolve) => setTimeout(resolve, 500));

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
});
