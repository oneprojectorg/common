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
 * Middleware that sets mutation channels for realtime subscriptions.
 * Intended for use with mutation procedures only.
 *
 * @param resolver - Array of channel names or function that returns channels based on input/ctx
 */
function withMutationChannels<TInput>(
  resolver: ChannelResolver<TInput> | ChannelName[],
) {
  return middleware(async ({ ctx, input, next }) => {
    const channels = Array.isArray(resolver)
      ? resolver
      : await resolver({ input: input as TInput, ctx: ctx as TContext & TContextWithUser });
    ctx.setChannels('mutation', channels);
    return next({ ctx });
  });
}

export default withMutationChannels;
