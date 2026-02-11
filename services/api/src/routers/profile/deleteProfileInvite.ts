import { deleteProfileInvite } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deleteProfileInviteRouter = router({
  deleteProfileInvite: commonAuthedProcedure()
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
