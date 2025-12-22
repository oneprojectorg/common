import type { ChannelName } from '@op/common/realtime';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { RealtimeMessage } from '../schemas';

/**
 * Service for publishing realtime messages via Supabase broadcast
 */
class RealtimeService {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
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

      this.client = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }

    return this.client;
  }

  /**
   * Publish a message to a channel via Supabase broadcast
   *
   * Note: Never query the database to determine channels. Channel selection should
   * be based on data you already have in the mutation context (orgId, userId, etc.)
   */
  async publish(channel: ChannelName, message: RealtimeMessage): Promise<void> {
    const client = this.getClient();

    try {
      const realtimeChannel = client.channel(channel);

      await realtimeChannel.send({
        type: 'broadcast',
        event: 'invalidation',
        payload: message,
      });

      // Unsubscribe immediately after sending (server doesn't need to maintain connection)
      await realtimeChannel.unsubscribe();
    } catch (error) {
      console.error('[Realtime] Publish failed:', error);
    }
  }
}

export const realtime = new RealtimeService();
