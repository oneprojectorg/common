import { updateProfileInvite } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const updateProfileInviteRouter = router({
  updateProfileInvite: commonAuthedProcedure()
    .input(
      z.object({
        inviteId: z.string().uuid(),
        accessRoleId: z.string().uuid(),
      }),
    )
    .output(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await updateProfileInvite({
        inviteId: input.inviteId,
        accessRoleId: input.accessRoleId,
        user: ctx.user,
      });

      return { id: result.id };
    }),
});
