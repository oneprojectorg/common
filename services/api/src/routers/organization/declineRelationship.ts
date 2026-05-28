import { declineRelationship } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  targetOrganizationId: z.uuid({
    error: 'Invalid target organization ID',
  }),
  ids: z.array(z.string()),
});

export const declineRelationshipRouter = router({
  declineRelationship: commonNetworkProcedure()
    .input(inputSchema)
    .output(z.boolean())
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { ids, targetOrganizationId } = input;

      await declineRelationship({
        user,
        targetOrganizationId,
        ids,
      });

      return true;
    }),
});
