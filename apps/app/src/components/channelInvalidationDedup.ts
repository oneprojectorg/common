import type { ChannelName } from '@op/common/realtime';

/** Bound on remembered (mutation, channel) pairs. */
const MAX_REMEMBERED_KEYS = 500;

/**
 * Remembers which channels of a mutation have already been invalidated, so the
 * same mutation is not acted on twice for the same channel.
 *
 * A mutation is announced twice to the client that issued it — once locally by
 * the tRPC link, once as the realtime echo — and a mutation that fans out to
 * several channels is published once per channel, every message carrying the
 * same mutation id. Remembering the id alone would therefore let whichever
 * message arrives first swallow the rest, leaving a subscriber that holds
 * queries on two of the mutation's channels refreshing only one of them.
 */
export class ChannelInvalidationDedup {
  private seen = new Map<string, true>();

  /**
   * Returns the channels not yet invalidated for this mutation, and marks them
   * as invalidated. An empty result means there is nothing left to do.
   */
  take(mutationId: string, channels: ChannelName[]): ChannelName[] {
    const fresh = channels.filter(
      (channel) => !this.seen.has(this.key(mutationId, channel)),
    );

    for (const channel of fresh) {
      this.seen.set(this.key(mutationId, channel), true);
    }

    // Oldest first: a Map iterates in insertion order.
    while (this.seen.size > MAX_REMEMBERED_KEYS) {
      const oldest = this.seen.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.seen.delete(oldest);
    }

    return fresh;
  }

  private key(mutationId: string, channel: ChannelName): string {
    return `${mutationId}:${channel}`;
  }
}
