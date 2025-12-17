import type { ChannelName } from '@op/common/realtime';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Middleware that sets mutation channels for realtime invalidation.
 * Intended for use with mutation procedures only.
 *
 * @param channels - Array of channel names to set for this mutation
 */
const withMutationChannels = (channels: ChannelName[]) => {
  const withMutationChannelsInner: MiddlewareBuilderBase = async ({
    ctx,
    next,
  }) => {
    ctx.setMutationChannels(channels);
    return next({ ctx });
  };

  return withMutationChannelsInner;
};

export default withMutationChannels;
