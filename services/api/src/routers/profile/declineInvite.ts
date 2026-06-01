import { declineProfileInvite } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../trpcFactory';

export const declineInviteRouter = router({
  declineInvite: commonNetworkProcedure()
    .input(
      z.object({
        inviteId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await declineProfileInvite({
        inviteId: input.inviteId,
        user: ctx.user,
      });
    }),
});
