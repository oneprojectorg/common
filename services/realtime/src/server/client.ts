import type { ChannelName } from '@op/common/realtime';

/**
 * Realtime backend client for publishing via Supabase Broadcast REST API
 */
export class RealtimeClient {
  private broadcastUrl: string;
  private serviceRoleKey: string;

  constructor(config: { supabaseUrl: string; serviceRoleKey: string }) {
    this.broadcastUrl = `${config.supabaseUrl}/realtime/v1/api/broadcast`;
    this.serviceRoleKey = config.serviceRoleKey;
  }

  /**
   * Publish a message to a single channel
   */
  async publish(options: {
    channel: ChannelName;
    data: unknown;
  }): Promise<void> {
    const { channel, data } = options;

    const response = await fetch(this.broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: channel,
            event: 'invalidation',
            payload: data,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Realtime publish failed: ${response.statusText}`);
    }
  }
}
