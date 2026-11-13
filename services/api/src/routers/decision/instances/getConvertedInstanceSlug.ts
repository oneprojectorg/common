import { getConvertedInstanceSlug } from '@op/common';

import {
  convertedInstanceSlugEncoder,
  getInstanceInputSchema,
} from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

/**
 * Used by the legacy route /profile/[slug]/decisions/[id] to redirect a
 * converted instance to /decisions/[slug]. Server-only caller, so it registers
 * no realtime channels. Same tier and rate limit as getInstance.
 */
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
