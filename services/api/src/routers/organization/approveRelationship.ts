import { approveRelationship } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { trackRelationshipAccepted } from '../../utils/analytics';

const inputSchema = z.object({
  targetOrganizationId: z.uuid({
    error: 'Invalid target organization ID',
  }),
  sourceOrganizationId: z.uuid({
    error: 'Invalid organization ID',
  }),
});

export const approveRelationshipRouter = router({
  approveRelationship: commonAuthedProcedure()
    .input(inputSchema)
    .output(z.boolean())
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { targetOrganizationId, sourceOrganizationId } = input;

      await approveRelationship({
        user,
        targetOrganizationId,
        sourceOrganizationId,
      });

      // Track analytics (non-blocking)
      waitUntil(trackRelationshipAccepted(ctx));

      return true;
    }),
});
