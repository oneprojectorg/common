import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';
import { waitUntil } from '@vercel/functions';

import { wrapResponseWithChannels } from '../channelTransformer';
import type { MiddlewareBuilderBase } from '../types';

/**
 * Wraps procedure responses to include channel metadata in the response body.
 *
 * Creates procedure-scoped channel storage to isolate channels per procedure call.
 * For mutations, also publishes invalidation events to realtime channels.
 *
 * The client-side link extracts channels and unwraps the data before it reaches the application.
 */
const withChannelMeta: MiddlewareBuilderBase = async ({ ctx, next }) => {
  // In case of batched requests, use procedure-scoped channel storage
  const procedureChannels: ChannelName[] = [];

  const result = ctx.isServerSideCall
    ? await next({ ctx })
    : await next({
        ctx: {
          registerQueryChannels: (channels: ChannelName[]) => {
            procedureChannels.push(...channels);
          },
          registerMutationChannels: (channels: ChannelName[]) => {
            procedureChannels.push(...channels);

            // The service dedupes channels, publishes them concurrently, and
            // settles each independently, so one failing channel doesn't take
            // the rest of the registration's invalidations with it.
            waitUntil(
              realtime.publishMany(channels, { mutationId: ctx.requestId }),
            );
          },
        },
      });

  // If procedure succeeded and has channels, wrap the response
  if (result.ok && procedureChannels.length > 0 && !ctx.isServerSideCall) {
    return {
      ...result,
      data: wrapResponseWithChannels(result.data, procedureChannels),
    };
  }

  return result;
};

export default withChannelMeta;
