import type { ChannelName } from '@op/realtime';

/**
 * Request-scoped accumulator for channels across batched tRPC procedures.
 *
 * When tRPC batches multiple procedures into a single HTTP request, each procedure
 * may declare its own subscription/mutation channels. This accumulator collects
 * all channels from all procedures in the batch, then merges them into a single
 * set of response headers.
 *
 * Usage:
 * 1. Create one accumulator per request (in createContext)
 * 2. Each procedure calls addSubscriptionChannels/addMutationChannels
 * 3. After fetchRequestHandler completes, call getHeaders() to get merged headers
 */
export class ChannelAccumulator {
  private subscriptionChannels = new Set<ChannelName>();
  private mutationChannels = new Set<ChannelName>();

  /**
   * Add subscription channels (used by queries to declare what they subscribe to)
   */
  addSubscriptionChannels(channels: ChannelName[]): void {
    for (const channel of channels) {
      this.subscriptionChannels.add(channel);
    }
  }

  /**
   * Add mutation channels (used by mutations to declare what data changed)
   */
  addMutationChannels(channels: ChannelName[]): void {
    for (const channel of channels) {
      this.mutationChannels.add(channel);
    }
  }

  /**
   * Get all accumulated subscription channels
   */
  getSubscriptionChannels(): ChannelName[] {
    return Array.from(this.subscriptionChannels);
  }

  /**
   * Get all accumulated mutation channels
   */
  getMutationChannels(): ChannelName[] {
    return Array.from(this.mutationChannels);
  }

  /**
   * Check if any channels have been accumulated
   */
  hasChannels(): boolean {
    return this.subscriptionChannels.size > 0 || this.mutationChannels.size > 0;
  }

  /**
   * Get the accumulated channels as header values.
   * Returns an object with header name -> value pairs for non-empty channel sets.
   */
  getHeaders(
    subscriptionHeader: string,
    mutationHeader: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.subscriptionChannels.size > 0) {
      headers[subscriptionHeader] = Array.from(this.subscriptionChannels).join(
        ',',
      );
    }

    if (this.mutationChannels.size > 0) {
      headers[mutationHeader] = Array.from(this.mutationChannels).join(',');
    }

    return headers;
  }
}
