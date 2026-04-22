import { deleteOrganization } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const outputSchema = z.object({
  deletedId: z.string().uuid(),
});

const inputSchema = z.object({
  organizationProfileId: z.uuid(),
});

export const deleteOrganizationRouter = router({
  deleteOrganization: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 5 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationProfileId } = input;
      const { user } = ctx;

      const deletedOrganization = await deleteOrganization({
        organizationProfileId,
        user,
      });

      return outputSchema.parse(deletedOrganization);
    }),
});
