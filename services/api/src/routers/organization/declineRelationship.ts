import { declineRelationship } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  targetOrganizationId: z.uuid({
    error: 'Invalid target organization ID',
  }),
  ids: z.array(z.string()),
});

export const declineRelationshipRouter = router({
  declineRelationship: commonAuthedProcedure()
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
