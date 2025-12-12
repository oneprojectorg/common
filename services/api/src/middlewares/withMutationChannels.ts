import type { ChannelName } from '@op/realtime';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Middleware that sets mutation channels for realtime subscriptions.
 * The channels will be sent to the client via the x-mutation-channels header.
 * Used in mutations to notify which data changed.
 *
 * @param channels - Array of channel names to set for this mutation
 */
const withMutationChannels = (channels: ChannelName[]) => {
  const withMutationChannelsInner: MiddlewareBuilderBase = async ({
    ctx,
    next,
  }) => {
    ctx.setChannels('mutation', channels);
    return next({ ctx });
  };

  return withMutationChannelsInner;
};

export default withMutationChannels;
