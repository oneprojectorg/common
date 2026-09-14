import { getCollabToken } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const getCollabTokenRouter = router({
  getCollabToken: authenticatedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 30 },
  })
    .input(z.object({ proposalProfileId: z.uuid() }))
    .output(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      return await getCollabToken({
        proposalProfileId: input.proposalProfileId,
        user: ctx.user,
      });
    }),
});
