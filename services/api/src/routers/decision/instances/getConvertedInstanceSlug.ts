import { getConvertedInstanceSlug } from '@op/common';

import {
  convertedInstanceSlugEncoder,
  getInstanceInputSchema,
} from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

/** Public lookup behind the legacy-route redirect; no client query reads it, so no realtime channels. Tier and rate limit match getInstance. */
export const getConvertedInstanceSlugRouter = router({
  getConvertedInstanceSlug: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(getInstanceInputSchema)
    .output(convertedInstanceSlugEncoder)
    .query(async ({ ctx, input }) => {
      const slug = await getConvertedInstanceSlug({
        instanceId: input.instanceId,
        user: ctx.user,
      });

      return { slug };
    }),
});
