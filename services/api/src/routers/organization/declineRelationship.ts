import { UnauthorizedError, declineRelationship } from '@op/common';
import { TRPCError } from '@trpc/server';
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

      try {
        await declineRelationship({
          user,
          targetOrganizationId,
          ids,
        });

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
          message: 'Could not decline relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
