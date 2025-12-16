import type { ChannelName } from '@op/common/realtime';

import { middleware } from '../trpcFactory';
import type { TContext, TContextWithUser } from '../types';

type ChannelResolverOpts<TInput> = {
  input: TInput;
  ctx: TContext & TContextWithUser;
};

type ChannelResolver<TInput> = (
  opts: ChannelResolverOpts<TInput>,
) => ChannelName[] | Promise<ChannelName[]>;

/**
 * Middleware that sets subscription channels for query invalidation.
 *
 * @param resolver - Array of channel names or function that returns channels based on input/ctx
 */
function withSubscriptionChannels<TInput>(
  resolver: ChannelResolver<TInput> | ChannelName[],
) {
  return middleware(async ({ ctx, input, next }) => {
    const channels = Array.isArray(resolver)
      ? resolver
      : await resolver({ input: input as TInput, ctx: ctx as TContext & TContextWithUser });
    ctx.setChannels('subscription', channels);
    return next({ ctx });
  });
}

export default withSubscriptionChannels;
