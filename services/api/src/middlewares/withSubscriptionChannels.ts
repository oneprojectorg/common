import type { ChannelName } from '@op/realtime';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Middleware that sets subscription channels for query invalidation.
 *
 * @param channels - Array of channel names to subscribe to
 */
const withSubscriptionChannels = (channels: ChannelName[]) => {
  const withSubscriptionChannelsInner: MiddlewareBuilderBase = async ({
    ctx,
    next,
  }) => {
    ctx.setChannels('subscription', channels);
    return next({ ctx });
  };

  return withSubscriptionChannelsInner;
};

export default withSubscriptionChannels;
