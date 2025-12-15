import type { ChannelName } from '@op/common/realtime';

import type { MiddlewareBuilderBase } from '../types';

/**
 * Middleware that sets mutation channels for realtime subscriptions.
 *
 * @param channels - Array of channel names to set for this mutation
 * TODO: can I limit this to only mutation contexts?
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
