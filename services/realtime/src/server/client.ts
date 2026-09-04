import type { ChannelName } from '@op/common/realtime';
import { withRetry } from '@op/core';

const PUBLISH_TIMEOUT_MS = 3_000;
const PUBLISH_RETRIES = 1;

/** Cap on echoed server error text, so an error page can't flood the logs. */
const ERROR_DETAIL_MAX_CHARS = 200;

/**
 * Supabase Realtime broadcast is best-effort. 5xx is transient and worth one
 * retry; 501 and 505 never heal. 429 is deliberately *not* retried — the
 * backoff (0–200ms) lands inside the same rate-limit window, so retrying just
 * doubles load on a tenant that already asked us to slow down. Clients recover
 * on their next full fetch.
 */
const isRetryableStatus = (status: number): boolean =>
  status >= 500 && status !== 501 && status !== 505;

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
   * Publish one message to one channel, retrying once on transient failures
   * (5xx, network errors, timeouts) with a fresh 3-second AbortSignal per
   * attempt. Non-retryable statuses surface immediately.
   *
   * Fan-out across channels is the caller's job — see
   * `RealtimeService.publishMany`, which settles each channel independently so
   * one failure doesn't discard the rest.
   */
  async publish(options: RealtimeBroadcastMessage): Promise<void> {
    const { channel, data } = options;

    const body = JSON.stringify({
      messages: [
        {
          topic: channel,
          event: 'invalidation',
          payload: data,
        },
      ],
    });

    // `withRetry` only retries what it catches, so a retryable status throws
    // and a non-retryable one is *returned* to opt out of the retry.
    const failure = await withRetry(
      async () => {
        const response = await fetch(this.broadcastUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.serviceRoleKey,
            Authorization: `Bearer ${this.serviceRoleKey}`,
          },
          body,
          signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
        });

        if (response.ok) {
          // Nothing reads the body, so release the socket back to the pool
          // instead of pinning it until GC — the retry would otherwise orphan
          // one connection per attempt.
          void response.body?.cancel();
          return null;
        }

        // Read the rejection reason before discarding the body: on a
        // non-retryable 4xx it is the only clue why (bad topic, rate limit).
        // Never includes the URL or key — this is Supabase's own text.
        const detail = await response
          .text()
          .then((text) => text.slice(0, ERROR_DETAIL_MAX_CHARS))
          .catch(() => '');

        const error = new Error(
          `Realtime publish failed with status ${response.status}${detail ? `: ${detail}` : ''}`,
        );

        if (isRetryableStatus(response.status)) {
          throw error;
        }

        return error;
      },
      { retries: PUBLISH_RETRIES },
    );

    if (failure) {
      throw failure;
    }
  }
}
