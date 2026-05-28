import { listUserInvites } from '@op/common';
import { EntityType } from '@op/db/schema';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../trpcFactory';

export const listUserInvitesRouter = router({
  listUserInvites: commonNetworkProcedure()
    .input(
      z.object({
        entityType: z.nativeEnum(EntityType).optional(),
        pending: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const invites = await listUserInvites({
        user: ctx.user,
        entityType: input.entityType,
        pending: input.pending,
      });

      return invites;
    }),
});
