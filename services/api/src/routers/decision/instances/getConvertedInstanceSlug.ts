import { getConvertedInstanceSlug } from '@op/common';

import {
  convertedInstanceSlugEncoder,
  getInstanceInputSchema,
} from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

/** Server-only lookup for the legacy-route redirect, so no realtime channels; tier and rate limit match getInstance. */
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
