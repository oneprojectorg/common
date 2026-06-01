import { switchUserOrganization } from '@op/common';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import { commonNetworkProcedure, router } from '../../trpcFactory';

export const switchOrganization = router({
  switchOrganization: commonNetworkProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { id } = ctx.user;

      const result = await switchUserOrganization({
        authUserId: id,
        organizationId: input.organizationId,
      });

      return userEncoder.parse(result);
    }),
});
