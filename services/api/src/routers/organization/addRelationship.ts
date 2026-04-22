import {
  Channels,
  addRelationship,
  sendRelationshipNotification,
} from '@op/common';
import { getCurrentOrgId } from '@op/common/src/services/access';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { trackRelationshipAdded } from '../../utils/analytics';

const inputSchema = z.object({
  // from: z.string().uuid({ message: 'Invalid source organization ID' }),
  to: z.uuid({
    error: 'Invalid target organization ID',
  }),
  relationships: z.array(z.string()),
});

export const addRelationshipRouter = router({
  addRelationship: commonAuthedProcedure()
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { to, relationships } = input;

      // TODO: We pull the org ID to add ORG relationships. We are transitioning to profile relationships. This should go away eventually
      const from = await getCurrentOrgId({ authUserId: user.id });

      await addRelationship({
        user,
        from,
        to,
        relationships,
      });

      ctx.registerMutationChannels([
        Channels.orgRelationshipRequest({
          type: 'source',
          orgId: from,
        }),
        Channels.orgRelationshipRequest({
          type: 'target',
          orgId: to,
        }),
      ]);

      // Track analytics and trigger async processes
      waitUntil(
        Promise.all([
          trackRelationshipAdded(ctx, relationships),
          sendRelationshipNotification({
            from,
            to,
            relationships,
          }),
        ]),
      );
    }),
});
