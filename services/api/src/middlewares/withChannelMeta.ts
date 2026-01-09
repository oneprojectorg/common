import type { MiddlewareBuilderBase } from '../types';

/**
 * Wraps procedure responses to include channel metadata in the response body.
 *
 * This middleware collects channels registered during procedure execution
 * (via ctx.registerQueryChannels/registerMutationChannels) and attaches them
 * to the response as `_meta`. The context already handles realtime publishing
 * for mutations.
 *
 * The client-side link is responsible for extracting channels and unwrapping
 * the data before it reaches the application.
 *
 * @example Response shape:
 * ```json
 * {
 *   "_data": { ...actualResponseData },
 *   "_meta": { "channels": ["org:123", "user:456"] }
 * }
 * ```
 */
const withChannelMeta: MiddlewareBuilderBase = async ({ ctx, next, type }) => {
  const result = await next();

  // Get channels collected during procedure execution
  const channels =
    type === 'query' ? ctx.getQueryChannels() : ctx.getMutationChannels();

  // If procedure succeeded and has channels, wrap the response
  if (result.ok && channels.length > 0 && !ctx.isServerSideCall) {
    return {
      ...result,
      data: {
        _data: result.data,
        _meta: {
          channels,
        },
      },
    };
  }

  return result;
};

export default withChannelMeta;
