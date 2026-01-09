import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';
import { waitUntil } from '@vercel/functions';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Wraps procedure responses to include channel metadata in the response body.
 *
 * This middleware creates procedure-scoped channel storage to isolate channels
 * per procedure call. This is necessary because batched requests share the same
 * context, and without isolation, channels from one procedure would leak into
 * other procedures in the batch.
 *
 * For mutations, this middleware also handles publishing invalidation events
 * to realtime channels.
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
const withChannelMeta: MiddlewareBuilderBase = async ({ ctx, next }) => {
  // In case of batched requests, use procedure-scoped channel storage
  const procedureChannels: ChannelName[] = [];

  const result = await next({
    ctx: {
      registerQueryChannels: (channels: ChannelName[]) => {
        procedureChannels.push(...channels);
      },
      registerMutationChannels: (channels: ChannelName[]) => {
        procedureChannels.push(...channels);
        // Publish mutation events to realtime channels
        for (const channel of channels) {
          waitUntil(
            realtime.publish(channel, {
              mutationId: ctx.requestId,
            }),
          );
        }
      },
    },
  });

  // If procedure succeeded and has channels, wrap the response
  if (result.ok && procedureChannels.length > 0 && !ctx.isServerSideCall) {
    return {
      ...result,
      data: {
        _data: result.data,
        _meta: {
          channels: procedureChannels,
        },
      },
    };
  }

  return result;
};

export default withChannelMeta;
