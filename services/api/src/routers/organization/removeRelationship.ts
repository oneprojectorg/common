import { Channels, removeRelationship } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  id: z.uuid({
    error: 'Invalid ID',
  }),
});

export const removeRelationshipRouter = router({
  removeRelationship: networkAuthenticatedProcedure()
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const { user } = ctx;

      const relationshipRemoved = await removeRelationship({
        id,
        user,
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
    }),
});
