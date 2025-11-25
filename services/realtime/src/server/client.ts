export interface RealtimeConfig {
  apiUrl: string; // e.g., 'http://localhost:8000/api'
  apiKey: string; // API key for authentication
}

export interface PublishOptions {
  channel: string;
  data: unknown;
}

export interface BroadcastOptions {
  channels: string[];
  data: unknown;
}

export class RealtimeClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: RealtimeConfig) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Publish a message to a single channel
   */
  async publish(options: PublishOptions): Promise<void> {
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
