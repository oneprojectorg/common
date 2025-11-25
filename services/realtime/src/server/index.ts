import type { CentrifugoMessage } from '../types';
import { CentrifugoClient } from './client';

// Singleton client instance
let client: CentrifugoClient | null = null;

function getClient(): CentrifugoClient {
  if (!client) {
    const apiUrl =
      process.env.CENTRIFUGO_API_URL || 'http://localhost:8000/api';
    const apiKey =
      process.env.CENTRIFUGO_API_KEY ||
      'c0wd5CQ8qy-7wmoehh_2Yda2-C7OqMno40cHbGxkxkkJDFd0ihj9rre0U66pMEDxJ889SuqIjIxXzm1ckLlcMQ';

    client = new CentrifugoClient({
      apiUrl,
      apiKey,
    });
  }
  return client;
}

/**
 * Publish a message to one or more channels
 *
 * Channel Selection Guide:
 * - Use `Channels.global()` for data visible to all users (explore page, global feed)
 * - Use `Channels.org(orgId)` for org-specific data (org feeds, org updates)
 * - Use `Channels.user(userId)` for personal notifications and user-specific data
 *
 * Important: Never query the database to determine channels. Channel selection should
 * be based on data you already have in the mutation context (orgId, userId, etc.)
 *
 * @example
 * // User-specific notification
 * await publishMessage(Channels.user(userId), {
 *   type: 'cache-invalidation',
 *   queryKey: ['user', 'notifications'],
 *   timestamp: Date.now(),
 * });
 */
export async function publishMessage(
  channel: string,
  message: CentrifugoMessage,
): Promise<void> {
  const centrifugo = getClient();

  try {
    await centrifugo.publish({ channel, data: message });

    console.log('[Realtime] Published:', { channel, type: message.type });
  } catch (error) {
    // Log but don't throw - realtime is not critical
    console.error('[Realtime] Publish failed:', error);
  }
}

// Re-export for convenience
export { Channels } from '../channels';
export type { CentrifugoMessage, InvalidationMessage } from '../types';
