import { Channels, UnauthorizedError, removeRelationship } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  id: z.uuid({
    error: 'Invalid ID',
  }),
});

export const removeRelationshipRouter = router({
  removeRelationship: commonAuthedProcedure()
    .input(inputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      try {
        const relationshipRemoved = await removeRelationship({
          id,
        });

        const sourceOrgId = relationshipRemoved.sourceOrganizationId;
        const targetOrgId = relationshipRemoved.targetOrganizationId;

        ctx.registerMutationChannels([
          Channels.orgRelationshipRequest({
            type: 'source',
            orgId: sourceOrgId,
          }),
          Channels.orgRelationshipRequest({
            type: 'target',
            orgId: targetOrgId,
          }),
        ]);

        return { success: true };
      } catch (error: unknown) {
        console.log('ERROR', error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Failed to remove relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
