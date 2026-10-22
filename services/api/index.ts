import type { TRPCClientError } from '@trpc/client';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from './src/routers';

export * from './src/routers';
export * from './src/trpcFactory';
export { handleSendEmailHookRequest } from './src/auth/handleSendEmailHookRequest';
export { readBodyWithLimit } from './src/utils/readBodyWithLimit';
export {
  handleModerationWebhookRequest,
  type ModerationWebhookRequest,
} from './src/moderation/handleModerationWebhookRequest';
export {
  handleTwilioStatusWebhookRequest,
  type TwilioStatusWebhookRequest,
} from './src/notification/handleTwilioStatusWebhookRequest';
export {
  handleTwilioInboundWebhookRequest,
  type TwilioInboundWebhookRequest,
} from './src/notification/handleTwilioInboundWebhookRequest';
export { resolveWebhookUrl } from './src/notification/resolveWebhookUrl';
export {
  unwrapResponseWithChannels,
  wrapResponseWithChannels,
  type WrappedResponse,
} from './src/channelTransformer';

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
export type TRPCError = TRPCClientError<AppRouter>;
/**
 * Enum containing all api query paths
 */
// export type TQuery = keyof AppRouter['_def']['queries'];
