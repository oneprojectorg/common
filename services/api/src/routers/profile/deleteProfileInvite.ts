import { deleteProfileInvite } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../trpcFactory';

export const deleteProfileInviteRouter = router({
  deleteProfileInvite: commonNetworkProcedure()
    .input(z.object({ inviteId: z.string().uuid() }))
    .output(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteProfileInvite({
        inviteId: input.inviteId,
        user: ctx.user,
      });

      return { id: result.id };
    }),
});
