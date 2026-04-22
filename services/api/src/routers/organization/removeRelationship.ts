import { Channels, removeRelationship } from '@op/common';
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
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

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
    }),
});
