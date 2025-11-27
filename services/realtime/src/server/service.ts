import type { ChannelName } from '../channels';
import type { RealtimeMessage } from '../schemas';
import { RealtimeClient } from './client';

/**
 * Service for communicating with the real-time messaging backend
 */
class RealtimeService {
  private client: RealtimeClient | null = null;

  private getClient(): RealtimeClient {
    if (!this.client) {
      const apiUrl = process.env.CENTRIFUGO_API_URL;
      const apiKey = process.env.CENTRIFUGO_API_KEY;

      if (!apiUrl) {
        throw new Error(
          '[Realtime] CENTRIFUGO_API_URL is not set. Realtime publishing will be disabled.',
        );
      }

      if (!apiKey) {
        throw new Error(
          '[Realtime] CENTRIFUGO_API_KEY is not set. Realtime publishing will be disabled.',
        );
      }

      this.client = new RealtimeClient({
        apiUrl,
        apiKey,
      });
    }

    return this.client;
  }

  /**
   * Publish a message to a channel
   *
   * Note: Never query the database to determine channels. Channel selection should
   * be based on data you already have in the mutation context (orgId, userId, etc.)
   */
  async publish(channel: ChannelName, message: RealtimeMessage): Promise<void> {
    const client = this.getClient();

    try {
      await client.publish({ channel, data: message });
    } catch (error) {
      console.error('[Realtime] Publish failed:', error);
    }
  }
}

export const realtime = new RealtimeService();
