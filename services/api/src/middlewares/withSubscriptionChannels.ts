import type { ChannelName } from '@op/realtime';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Middleware that sets subscription channels for query invalidation.
 * The channels will be sent to the client via the x-subscription-channels header.
 * Used in queries to declare which channels they subscribe to.
 *
 * @param channels - Array of channel names to subscribe to
 */
const withSubscriptionChannels = (channels: ChannelName[]) => {
  const withSubscriptionChannelsInner: MiddlewareBuilderBase = async ({
    ctx,
    next,
  }) => {
    ctx.setSubscriptionChannels(channels);
    return next({ ctx });
  };

  return withSubscriptionChannelsInner;
};

export default withSubscriptionChannels;
