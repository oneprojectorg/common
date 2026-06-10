import { declineRelationship } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  targetOrganizationId: z.uuid({
    error: 'Invalid target organization ID',
  }),
  ids: z.array(
    z.uuid({
      error: 'Invalid relationship ID',
    }),
  ),
});

export const declineRelationshipRouter = router({
  declineRelationship: networkAuthenticatedProcedure()
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
