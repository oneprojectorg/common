import {
  MUTATION_CHANNELS_HEADER,
  SUBSCRIPTION_CHANNELS_HEADER,
  appRouter,
  createContext,
} from '@op/api';
import { API_OPENAPI_PATH } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { verifyAdminOnly } from '../../../route';

const handler = async (req: Request) => {
  const supabase = await createSBServerClient();
  const data = await supabase.auth.getUser();

  verifyAdminOnly(data);

  return fetchRequestHandler({
    endpoint: `/${API_OPENAPI_PATH}`,
    req,
    router: appRouter,
    createContext,
    responseMeta({ ctx }) {
      if (!ctx) {
        return {};
      }

      const headers: Record<string, string> = {};
      const mutationChannels = ctx.getMutationChannels();
      const subscriptionChannels = ctx.getSubscriptionChannels();

      if (subscriptionChannels.length > 0) {
        headers[SUBSCRIPTION_CHANNELS_HEADER] = subscriptionChannels.join(',');
      }
      if (mutationChannels.length > 0) {
        headers[MUTATION_CHANNELS_HEADER] = mutationChannels.join(',');
      }

      if (Object.keys(headers).length > 0) {
        return {
          headers: new Headers(Object.entries(headers)),
        };
      }

      return {};
    },
  });
};

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
