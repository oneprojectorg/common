import type { ChannelName } from '@op/common/realtime';

/**
 * Realtime backend client for interacting with the real-time messaging service
 */
export class RealtimeClient {
  private apiUrl: string;
  private apiKey: string;

  /**
   * apiURL: Base URL of the realtime API (e.g the admin API for Centrifugo)
   * apiKey: API key for authenticating requests
   */
  constructor(config: { apiUrl: string; apiKey: string }) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Publish a message to a single channel
   */
  async publish(options: {
    channel: ChannelName;
    data: unknown;
  }): Promise<void> {
    const { channel, data } = options;

    const response = await fetch(`${this.apiUrl}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ channel, data }),
    });

    if (!response.ok) {
      throw new Error(`Realtime publish failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(`Realtime error: ${result.error.message}`);
    }
  }
}
