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

/**
 * Fan-out size is data-driven and unbounded, so it can never be a raw metric
 * attribute — that is one time series per distinct channel count. Bucket it.
 */
const bucketTopicCount = (count: number): string => {
  if (count === 1) {
    return '1';
  }
  if (count <= 10) {
    return '2-10';
  }
  if (count <= 100) {
    return '11-100';
  }
  return '100+';
};

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
   * Publish the same message to many channels in a single broadcast call.
   *
   * Channels are deduplicated. Empty input is a no-op. Failures are
   * swallowed and counted via the `realtime.publish.failures` OTel
   * counter — publishing is best-effort: by the time we are here, the
   * mutation has already committed and clients will recover on the next
   * full fetch.
   */
  async publishMany(
    channels: ReadonlyArray<ChannelName>,
    message: RealtimeMessage,
  ): Promise<void> {
    const unique = dedupeChannels(channels);
    if (unique.length === 0) {
      return;
    }

    try {
      await this.getClient().publishMany({
        messages: unique.map((channel) => ({ channel, data: message })),
      });
    } catch (error) {
      getFailureCounter().add(1, { topics: bucketTopicCount(unique.length) });
      // Keep channel names: without them a silent invalidation outage gives no
      // clue which surfaces went stale. Pass the Error itself so the stack
      // survives.
      logger.error('[Realtime] publishMany failed', {
        topics: unique.length,
        channels: unique.slice(0, LOGGED_CHANNELS),
        error,
      });
    }
  }
}

export const realtime = new RealtimeService();
