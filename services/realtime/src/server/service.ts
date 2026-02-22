import type { ChannelName } from '@op/common/realtime';

import type { RealtimeMessage } from '../schemas';
import { RealtimeClient } from './client';

/**
 * Service for communicating with the real-time messaging backend
 */
class RealtimeService {
  private client: RealtimeClient | null = null;

  private getClient(): RealtimeClient {
    if (!this.client) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

      if (!supabaseUrl) {
        throw new Error(
          '[Realtime] NEXT_PUBLIC_SUPABASE_URL is not set. Realtime publishing will be disabled.',
        );
      }

      if (!serviceRoleKey) {
        throw new Error(
          '[Realtime] SUPABASE_SERVICE_ROLE is not set. Realtime publishing will be disabled.',
        );
      }

      this.client = new RealtimeClient({
        supabaseUrl,
        serviceRoleKey,
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
