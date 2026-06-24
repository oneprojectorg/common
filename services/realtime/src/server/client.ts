import type { ChannelName } from '@op/common/realtime';
import { withRetry } from '@op/core';

const PUBLISH_TIMEOUT_MS = 3_000;
const PUBLISH_RETRIES = 1;

/** Supabase Realtime broadcast is best-effort; 429 / 5xx are transient. */
const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500;

export interface RealtimeBroadcastMessage {
  channel: ChannelName;
  data: unknown;
}

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
   * Publish one message to one channel. Convenience wrapper around
   * `publishMany` for callers that only have a single topic.
   */
  publish(options: RealtimeBroadcastMessage): Promise<void> {
    return this.publishMany({ messages: [options] });
  }

  /**
   * Publish multiple messages in a single broadcast call. The Supabase
   * Realtime REST endpoint accepts a multi-topic `messages` array, so this
   * collapses N per-channel HTTP round-trips into one.
   *
   * Retries once on transient failures (429 / 5xx or network errors / timeouts)
   * with a fresh 3-second AbortSignal per attempt. Non-retryable 4xx responses
   * surface immediately.
   */
  async publishMany(options: {
    messages: ReadonlyArray<RealtimeBroadcastMessage>;
  }): Promise<void> {
    const { messages } = options;
    if (messages.length === 0) {
      return;
    }

    const body = JSON.stringify({
      messages: messages.map(({ channel, data }) => ({
        topic: channel,
        event: 'invalidation',
        payload: data,
      })),
    });

    const response = await withRetry(
      async () => {
        const r = await fetch(this.broadcastUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.serviceRoleKey,
            Authorization: `Bearer ${this.serviceRoleKey}`,
          },
          body,
          signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
        });

        if (!r.ok && isRetryableStatus(r.status)) {
          // Throw to trigger a retry; status only, never the URL/key.
          throw new Error(`Realtime publish failed with status ${r.status}`);
        }

        return r;
      },
      { retries: PUBLISH_RETRIES },
    );

    if (!response.ok) {
      throw new Error(`Realtime publish failed with status ${response.status}`);
    }
  }
}
