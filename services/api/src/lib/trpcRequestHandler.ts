import type { AnyTRPCRouter } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import {
  MUTATION_CHANNELS_HEADER,
  SUBSCRIPTION_CHANNELS_HEADER,
} from '../constants';
import type { CreateContextOptions } from '../trpcFactory';
import { ChannelAccumulator } from './channelAccumulator';

/**
 * Options for the tRPC request handler with channel accumulation support.
 */
interface TRPCRequestHandlerOptions<TRouter extends AnyTRPCRouter> {
  /** The tRPC endpoint path (e.g., '/api/trpc') */
  endpoint: string;
  /** The incoming request */
  req: Request;
  /** The tRPC router */
  router: TRouter;
  /** Context factory function */
  createContext: (opts: CreateContextOptions) => Promise<unknown>;
  /** Optional error handler */
  onError?: Parameters<typeof fetchRequestHandler>[0]['onError'];
}

/**
 * Wrapper around fetchRequestHandler that handles channel accumulation.
 *
 * Each procedure can declare subscription/mutation channels via middleware.
 * This wrapper:
 *
 * 1. Creates a ChannelAccumulator shared across all procedures in the request
 * 2. Passes the accumulator to createContext
 * 3. After all procedures complete, merges accumulated channels into response headers
 *
 * This works for both single and batched requests - channels are always accumulated
 * and merged into a single set of response headers.
 */
export async function handleTRPCRequest<TRouter extends AnyTRPCRouter>({
  endpoint,
  req,
  router,
  createContext,
  onError,
}: TRPCRequestHandlerOptions<TRouter>): Promise<Response> {
  const channelAccumulator = new ChannelAccumulator();

  const response = await fetchRequestHandler({
    endpoint,
    req,
    router,
    createContext: (opts) =>
      createContext({
        ...opts,
        channelAccumulator,
      }),
    onError,
  });

  // Merge accumulated channels into response headers
  const channelHeaders = channelAccumulator.getHeaders(
    SUBSCRIPTION_CHANNELS_HEADER,
    MUTATION_CHANNELS_HEADER,
  );

  if (Object.keys(channelHeaders).length > 0) {
    // Clone response to modify headers (Response headers are immutable)
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(channelHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return response;
}
