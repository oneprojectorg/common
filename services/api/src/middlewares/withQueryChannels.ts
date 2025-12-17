import type { ChannelName } from '@op/common/realtime';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Middleware that sets query channels for realtime invalidation.
 *
 * @param channels - Array of channel names to subscribe to
 */
const withQueryChannels = (channels: ChannelName[]) => {
  const withQueryChannelsInner: MiddlewareBuilderBase = async ({
    ctx,
    next,
  }) => {
    ctx.setQueryChannels(channels);
    return next({ ctx });
  };

  return withQueryChannelsInner;
};

export default withQueryChannels;
