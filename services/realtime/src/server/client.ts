import type { ChannelName } from '@op/common/realtime';
import { withRetry } from '@op/core';

const PUBLISH_TIMEOUT_MS = 3_000;
const PUBLISH_RETRIES = 1;

/**
 * Cap on messages per broadcast request. Channel fan-out is data-driven and
 * unbounded (the SELECTs feeding it have no LIMIT), so without a cap one
 * oversized POST would fail as a unit and take every invalidation with it.
 * Chunking keeps the blast radius of a failure to a single chunk.
 *
 * Supabase enforces its own per-request ceiling tied to `max_events_per_second`
 * (default 100) and rejects anything over it with a 429 whose body reads
 * "Too many messages to broadcast, please reduce the batch size". Measured
 * against the local stack, 91 messages is accepted and 92 is not. 50 leaves
 * deliberate headroom, since a hosted project can be configured lower. The
 * ceiling is per *request*, not aggregate — 10 concurrent chunks of 50 all
 * succeed — so chunks are still sent in parallel.
 */
const MAX_MESSAGES_PER_REQUEST = 50;

/** Cap on echoed server error text, so an error page can't flood the logs. */
const ERROR_DETAIL_MAX_CHARS = 200;

/**
 * Supabase Realtime broadcast is best-effort. 5xx is transient and worth one
 * retry; 501 and 505 never heal. 429 is deliberately *not* retried — the
 * backoff (0–200ms) lands inside the same rate-limit window, so retrying just
 * doubles load on a tenant that already asked us to slow down. Clients recover
 * on their next full fetch.
 *
 * Note that Supabase also returns 429 for an oversized batch, which no amount
 * of retrying would fix; `MAX_MESSAGES_PER_REQUEST` prevents that case by
 * construction rather than by retry.
 */
const isRetryableStatus = (status: number): boolean =>
  status >= 500 && status !== 501 && status !== 505;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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
   * collapses N per-channel HTTP round-trips into one — or into
   * `ceil(N / 100)` for a wide fan-out.
   *
   * Chunks are sent concurrently and settled independently, so one failing
   * chunk does not discard the others' invalidations. Rejects if any chunk
   * failed, naming how many.
   */
  async publishMany(options: {
    messages: ReadonlyArray<RealtimeBroadcastMessage>;
  }): Promise<void> {
    const { messages } = options;
    if (messages.length === 0) {
      return;
    }

    const chunks: ReadonlyArray<RealtimeBroadcastMessage>[] = [];
    for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_REQUEST) {
      chunks.push(messages.slice(i, i + MAX_MESSAGES_PER_REQUEST));
    }

    const results = await Promise.allSettled(
      chunks.map((chunk) => this.sendChunk(chunk)),
    );

    const reasons = results.flatMap((result) =>
      result.status === 'rejected' ? [messageOf(result.reason)] : [],
    );

    if (reasons.length > 0) {
      throw new Error(
        `Realtime publish failed for ${reasons.length} of ${chunks.length} chunk(s): ${reasons.join('; ')}`,
      );
    }
  }

  /**
   * POST one chunk, retrying once on transient failures (5xx, network errors,
   * timeouts) with a fresh 3-second AbortSignal per attempt. Non-retryable
   * statuses surface immediately.
   */
  private async sendChunk(
    messages: ReadonlyArray<RealtimeBroadcastMessage>,
  ): Promise<void> {
    const body = JSON.stringify({
      messages: messages.map(({ channel, data }) => ({
        topic: channel,
        event: 'invalidation',
        payload: data,
      })),
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
        // non-retryable 4xx it is the only clue why (bad topic, oversize).
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
