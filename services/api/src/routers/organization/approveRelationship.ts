import { UnauthorizedError, approveRelationship } from '@op/common';
import { TRPCError } from '@trpc/server';
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

      try {
        await approveRelationship({
          user,
          targetOrganizationId,
          sourceOrganizationId,
        });

        // Track analytics (non-blocking)
        waitUntil(trackRelationshipAccepted(ctx));

        return true;
      } catch (error: unknown) {
        console.log('ERROR', error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Could not approve relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
