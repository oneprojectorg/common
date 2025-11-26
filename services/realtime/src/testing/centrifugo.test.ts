/**
 * Centrifugo integration tests
 *
 * These tests require Centrifugo to be running:
 *   pnpm w:realtime test:centrifugo:start
 *
 * Run tests:
 *   pnpm w:realtime test:run
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { Centrifuge } from 'centrifuge';
import {
  isCentrifugoHealthy,
  createTestClient,
  waitForClientConnect,
  waitForSubscription,
  waitForPublications,
  setupTestSubscription,
  cleanupTestClient,
  generateTestChannel,
  generateConnectionToken,
  publish,
} from './index';

describe('Centrifugo Integration Tests', () => {
  const clients: Centrifuge[] = [];

  beforeAll(async () => {
    // Check if Centrifugo is running, skip tests if not
    const isHealthy = await isCentrifugoHealthy();
    if (!isHealthy) {
      console.warn(
        '\n⚠️  Centrifugo is not running. Skipping integration tests.',
      );
      console.warn('   Start Centrifugo with: pnpm w:realtime test:centrifugo:start\n');
      return;
    }
  });

  afterEach(() => {
    // Clean up all test clients
    clients.forEach((client) => cleanupTestClient(client));
    clients.length = 0;
  });

  describe('Health Check', () => {
    it('should report Centrifugo health status', async () => {
      const healthy = await isCentrifugoHealthy();
      // This test passes regardless of status - it's testing the function works
      expect(typeof healthy).toBe('boolean');
    });
  });

  describe('Token Generation', () => {
    it('should generate valid connection tokens', () => {
      const token = generateConnectionToken('user-123');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('Client Connection', () => {
    it('should connect a client with valid token', async () => {
      const healthy = await isCentrifugoHealthy();
      if (!healthy) {
        return;
      }

      const client = createTestClient('test-user-1');
      clients.push(client);

      await waitForClientConnect(client);
      expect(client.state).toBe('connected');
    });
  });

  describe('Pub/Sub', () => {
    it('should subscribe to a channel', async () => {
      const healthy = await isCentrifugoHealthy();
      if (!healthy) {
        return;
      }

      const client = createTestClient('test-user-2');
      clients.push(client);

      await waitForClientConnect(client);

      const channel = generateTestChannel('sub-test');
      const sub = client.newSubscription(channel);

      await waitForSubscription(sub);
      expect(sub.state).toBe('subscribed');

      sub.unsubscribe();
    });

    it('should receive publications from server', async () => {
      const healthy = await isCentrifugoHealthy();
      if (!healthy) {
        return;
      }

      const client = createTestClient('test-user-3');
      clients.push(client);

      await waitForClientConnect(client);

      const channel = generateTestChannel('pub-test');
      const { subscription, publications, cleanup } = setupTestSubscription<{
        message: string;
      }>(client, channel);

      await waitForSubscription(subscription);

      // Publish from server
      await publish(channel, { message: 'Hello from server!' });

      // Wait a bit for the message to arrive
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(publications.length).toBeGreaterThanOrEqual(1);
      expect(publications[0]).toEqual({ message: 'Hello from server!' });

      cleanup();
    });

    it('should receive multiple publications', async () => {
      const healthy = await isCentrifugoHealthy();
      if (!healthy) {
        return;
      }

      const client = createTestClient('test-user-4');
      clients.push(client);

      await waitForClientConnect(client);

      const channel = generateTestChannel('multi-pub-test');

      // Start waiting for publications before sending
      const publicationsPromise = waitForPublications<{ count: number }>(
        client,
        channel,
        3,
        10000,
      );

      // Small delay to ensure subscription is ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Publish multiple messages from server
      await publish(channel, { count: 1 });
      await publish(channel, { count: 2 });
      await publish(channel, { count: 3 });

      const received = await publicationsPromise;

      expect(received).toHaveLength(3);
      expect(received.map((p) => p.count)).toEqual([1, 2, 3]);
    });
  });

  describe('Test Utilities', () => {
    it('should generate unique channel names', () => {
      const channel1 = generateTestChannel('util');
      const channel2 = generateTestChannel('util');

      expect(channel1).not.toBe(channel2);
      expect(channel1).toMatch(/^util:\d+:[a-z0-9]+$/);
    });
  });
});
