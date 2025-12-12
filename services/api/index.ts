import type { TRPCClientError } from '@trpc/client';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from './src/routers';

export * from './src/routers';
export * from './src/trpcFactory';
export {
  MUTATION_CHANNELS_HEADER,
  SUBSCRIPTION_CHANNELS_HEADER,
} from './src/constants';

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
export type TRPCError = TRPCClientError<AppRouter>;
/**
 * Enum containing all api query paths
 */
// export type TQuery = keyof AppRouter['_def']['queries'];
