import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';
import { waitUntil } from '@vercel/functions';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Wraps procedure responses to include channel metadata in the response body.
 *
 * This middleware creates an isolated channel set for each procedure call,
 * allowing proper channel tracking even with batched requests. Channels are
 * collected during procedure execution and attached to the response as `_meta`.
 *
 * For mutations, it also publishes invalidation events to the realtime system.
 *
 * The client-side link is responsible for extracting channels and unwrapping
 * the data before it reaches the application.
 *
 * @example Response shape:
 * ```json
 * {
 *   "_data": { ...actualResponseData },
 *   "_meta": { "channels": ["org:123", "user:456"] }
 * }
 * ```
 */
const withChannelMeta: MiddlewareBuilderBase = async ({ ctx, next, type }) => {
  // Create isolated channel set for this procedure call
  const channels = new Set<ChannelName>();

  const registerChannels = (newChannels: ChannelName[]) => {
    for (const channel of newChannels) {
      channels.add(channel);
    }
  };

  // For mutations, also publish to realtime when channels are registered
  const registerMutationChannels = (newChannels: ChannelName[]) => {
    for (const channel of newChannels) {
      channels.add(channel);
      // Publish mutation event to channel for realtime invalidation
      waitUntil(
        realtime.publish(channel, {
          mutationId: ctx.requestId,
        }),
      );
    }
  };

  const result = await next({
    ctx: {
      ...ctx,
      registerQueryChannels:
        type === 'query' ? registerChannels : ctx.registerQueryChannels,
      registerMutationChannels:
        type === 'mutation'
          ? registerMutationChannels
          : ctx.registerMutationChannels,
    },
  });

  // If procedure succeeded and has channels, wrap the response
  if (result.ok && channels.size > 0 && !ctx.isServerSideCall) {
    return {
      ...result,
      data: {
        _data: result.data,
        _meta: {
          channels: Array.from(channels),
        },
      },
    };
  }

  return result;
};

export default withChannelMeta;
