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
 * This wrapper uses tRPC's `responseMeta` to inject channel headers directly,
 * avoiding the need to clone the response after the fact.
 *
 * Works for both single and batched requests - channels are accumulated
 * and merged into a single set of response headers.
 */
export function handleTRPCRequest<TRouter extends AnyTRPCRouter>({
  endpoint,
  req,
  router,
  createContext,
  onError,
}: TRPCRequestHandlerOptions<TRouter>): Promise<Response> {
  const channelAccumulator = new ChannelAccumulator();

  return fetchRequestHandler({
    endpoint,
    req,
    router,
    createContext: (opts) =>
      createContext({
        ...opts,
        channelAccumulator,
      }),
    onError,
    responseMeta() {
      const channelHeaders = channelAccumulator.getHeaders(
        SUBSCRIPTION_CHANNELS_HEADER,
        MUTATION_CHANNELS_HEADER,
      );

      if (Object.keys(channelHeaders).length > 0) {
        return {
          headers: new Headers(Object.entries(channelHeaders)),
        };
      }

      return {};
    },
  });
}
