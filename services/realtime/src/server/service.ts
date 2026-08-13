import type { ChannelName } from '@op/common/realtime';
import type { Counter } from '@op/logging';
import { logger, metrics } from '@op/logging';

import type { RealtimeMessage } from '../schemas';
import { RealtimeClient } from './client';

let failureCounter: Counter | null = null;
const getFailureCounter = (): Counter => {
  if (!failureCounter) {
    failureCounter = metrics
      .getMeter('realtime')
      .createCounter('realtime.publish.failures', {
        description:
          'Number of realtime broadcast publishes that failed after retries.',
        unit: '1',
      });
  }
  return failureCounter;
};

const dedupeChannels = (channels: ReadonlyArray<ChannelName>): ChannelName[] =>
  Array.from(new Set(channels));

/** Cap on channel names in a failure log line, so a wide fan-out can't flood. */
const LOGGED_CHANNELS = 10;

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
   * Publish a message to a channel.
   *
   * Convenience wrapper around `publishMany` for single-channel callers.
   * Note: Never query the database to determine channels. Channel selection
   * should be based on data you already have in the mutation context
   * (orgId, userId, etc.)
   */
  publish(channel: ChannelName, message: RealtimeMessage): Promise<void> {
    return this.publishMany([channel], message);
  }

  /**
   * Publish the same message to every given channel, one request each, sent
   * concurrently and settled independently so a single failing channel does
   * not discard the others' invalidations.
   *
   * Channels are deduplicated. Empty input is a no-op. Failures are swallowed
   * and counted via the `realtime.publish.failures` OTel counter — publishing
   * is best-effort: by the time we are here, the mutation has already
   * committed and clients will recover on the next full fetch.
   */
  async publishMany(
    channels: ReadonlyArray<ChannelName>,
    message: RealtimeMessage,
  ): Promise<void> {
    const unique = dedupeChannels(channels);
    if (unique.length === 0) {
      return;
    }

    // A missing-env throw is a whole-service failure, not a per-channel one,
    // so it is caught separately — and still swallowed, since callers publish
    // after their mutation has already committed.
    let client: RealtimeClient;
    try {
      client = this.getClient();
    } catch (error) {
      getFailureCounter().add(unique.length);
      logger.error('[Realtime] publish client unavailable', {
        topics: unique.length,
        error,
      });
      return;
    }

    const results = await Promise.allSettled(
      unique.map((channel) => client.publish({ channel, data: message })),
    );

    const failed = unique.filter((_, i) => results[i]?.status === 'rejected');
    if (failed.length === 0) {
      return;
    }

    // Counts failed *channels*, so the metric needs no attribute at all —
    // fan-out size is data-driven and unbounded, and would be one time series
    // per distinct count.
    getFailureCounter().add(failed.length);

    const firstRejection = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    // Keep channel names: without them a silent invalidation outage gives no
    // clue which surfaces went stale. Pass the Error itself so the stack
    // survives.
    logger.error('[Realtime] publishMany failed', {
      topics: unique.length,
      failed: failed.length,
      channels: failed.slice(0, LOGGED_CHANNELS),
      error: firstRejection?.reason,
    });
  }
}

export const realtime = new RealtimeService();
