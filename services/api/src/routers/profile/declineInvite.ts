import { declineProfileInvite } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const declineInviteRouter = router({
  declineInvite: commonAuthedProcedure()
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
