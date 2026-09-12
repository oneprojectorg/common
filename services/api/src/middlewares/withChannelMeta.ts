import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';
import { waitUntil } from '@vercel/functions';

import { wrapResponseWithChannels } from '../channelTransformer';
import type { MiddlewareBuilderBase } from '../types';

/**
 * Collects the channels a procedure registers and hands them to the caller.
 *
 * Creates procedure-scoped channel storage to isolate channels per procedure call.
 *
 * Over HTTP the channels are wrapped into the response body, and the
 * client-side link extracts them and unwraps the data before it reaches the
 * application. For mutations, invalidation events are also published to the
 * channels.
 *
 * A server-side call has no response body to ride on, so a query reports its
 * channels through `ctx.onQueryChannels` instead; a server prefetch uses that
 * to carry them into the dehydrated React Query cache. Server-side mutations
 * publish nothing — the context stub stays in place.
 */
const withChannelMeta: MiddlewareBuilderBase = async ({
  ctx,
  next,
  path,
  type,
  getRawInput,
}) => {
  // In case of batched requests, use procedure-scoped channel storage
  const procedureChannels: ChannelName[] = [];

  const registerQueryChannels = (channels: ChannelName[]) => {
    procedureChannels.push(...channels);
  };

  const result = ctx.isServerSideCall
    ? await next({ ctx: { registerQueryChannels } })
    : await next({
        ctx: {
          registerQueryChannels,
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

  if (!result.ok || procedureChannels.length === 0) {
    return result;
  }

  if (!ctx.isServerSideCall) {
    return {
      ...result,
      data: wrapResponseWithChannels(result.data, procedureChannels),
    };
  }

  if (type === 'query') {
    ctx.onQueryChannels?.({
      path,
      input: await getRawInput(),
      channels: procedureChannels,
    });
  }

  return result;
};

export default withChannelMeta;
