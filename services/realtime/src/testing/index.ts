import { Centrifuge, PublicationContext, Subscription } from 'centrifuge';
import { generateConnectionToken } from '../server/token';
import { createCentrifugoClient, subscribeToChannel } from '../client';

export { generateConnectionToken } from '../server/token';
export * from '../server/publish';
export * from '../client';

/**
 * Test environment configuration
 */
export const TEST_CONFIG = {
  CENTRIFUGO_URL: process.env.CENTRIFUGO_URL ?? 'http://127.0.0.1:8000',
  CENTRIFUGO_WS_URL:
    process.env.CENTRIFUGO_WS_URL ?? 'ws://127.0.0.1:8000/connection/websocket',
  CENTRIFUGO_API_KEY: process.env.CENTRIFUGO_API_KEY ?? 'test-api-key',
  CENTRIFUGO_TOKEN_SECRET:
    process.env.CENTRIFUGO_TOKEN_SECRET ??
    'test-centrifugo-secret-key-for-local-dev',
};

/**
 * Check if Centrifugo is running and healthy
 */
export async function isCentrifugoHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${TEST_CONFIG.CENTRIFUGO_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for Centrifugo to become healthy with retries
 */
export async function waitForCentrifugo(
  maxRetries = 30,
  retryIntervalMs = 1000,
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    if (await isCentrifugoHealthy()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
  }
  throw new Error(
    `Centrifugo not healthy after ${maxRetries * retryIntervalMs}ms. ` +
      `Make sure Centrifugo is running: pnpm w:realtime test:centrifugo:start`,
  );
}

/**
 * Create a test client with a generated token for the given user
 */
export function createTestClient(userId: string): Centrifuge {
  const token = generateConnectionToken(userId);
  return createCentrifugoClient({
    url: TEST_CONFIG.CENTRIFUGO_WS_URL,
    token,
    debug: false,
  });
}

/**
 * Wait for a client to connect
 */
export function waitForClientConnect(
  client: Centrifuge,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Client connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    client.on('connected', () => {
      clearTimeout(timeout);
      resolve();
    });

    client.on('error', (ctx) => {
      clearTimeout(timeout);
      reject(new Error(`Client error: ${ctx.error?.message ?? 'Unknown'}`));
    });

    client.connect();
  });
}

/**
 * Wait for a subscription to be established
 */
export function waitForSubscription(
  subscription: Subscription,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Subscription timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    subscription.on('subscribed', () => {
      clearTimeout(timeout);
      resolve();
    });

    subscription.on('error', (ctx) => {
      clearTimeout(timeout);
      reject(new Error(`Subscription error: ${ctx.error?.message ?? 'Unknown'}`));
    });
  });
}

/**
 * Collect publications from a channel for a specified duration
 */
export function collectPublications<T = unknown>(
  client: Centrifuge,
  channel: string,
  durationMs: number,
): Promise<T[]> {
  return new Promise((resolve) => {
    const publications: T[] = [];

    const sub = subscribeToChannel(client, {
      channel,
      onPublication: (ctx: PublicationContext) => {
        publications.push(ctx.data as T);
      },
    });

    sub.subscribe();

    setTimeout(() => {
      sub.unsubscribe();
      resolve(publications);
    }, durationMs);
  });
}

/**
 * Wait for a specific number of publications on a channel
 */
export function waitForPublications<T = unknown>(
  client: Centrifuge,
  channel: string,
  count: number,
  timeoutMs = 5000,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const publications: T[] = [];

    const timeout = setTimeout(() => {
      sub.unsubscribe();
      reject(
        new Error(
          `Timeout waiting for ${count} publications. Received ${publications.length}`,
        ),
      );
    }, timeoutMs);

    const sub = subscribeToChannel(client, {
      channel,
      onPublication: (ctx: PublicationContext) => {
        publications.push(ctx.data as T);
        if (publications.length >= count) {
          clearTimeout(timeout);
          sub.unsubscribe();
          resolve(publications);
        }
      },
    });

    sub.subscribe();
  });
}

/**
 * Test helper: Set up a subscription and return cleanup function
 */
export interface TestSubscriptionResult<T = unknown> {
  subscription: Subscription;
  publications: T[];
  cleanup: () => void;
}

export function setupTestSubscription<T = unknown>(
  client: Centrifuge,
  channel: string,
): TestSubscriptionResult<T> {
  const publications: T[] = [];

  const subscription = subscribeToChannel(client, {
    channel,
    onPublication: (ctx: PublicationContext) => {
      publications.push(ctx.data as T);
    },
  });

  const cleanup = () => {
    subscription.unsubscribe();
  };

  return { subscription, publications, cleanup };
}

/**
 * Clean up a test client and all its subscriptions
 */
export function cleanupTestClient(client: Centrifuge): void {
  client.disconnect();
}

/**
 * Generate a unique channel name for testing
 */
export function generateTestChannel(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}:${timestamp}:${random}`;
}
