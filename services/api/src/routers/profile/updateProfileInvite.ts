import { updateProfileInvite } from '@op/common';
import { z } from 'zod';

import { profileInviteEncoder } from '../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const updateProfileInviteRouter = router({
  updateProfileInvite: commonAuthedProcedure()
    .input(
      z.object({
        inviteId: z.string().uuid(),
        accessRoleId: z.string().uuid(),
      }),
    )
    .output(profileInviteEncoder)
    .mutation(async ({ ctx, input }) => {
      return updateProfileInvite({
        inviteId: input.inviteId,
        accessRoleId: input.accessRoleId,
        user: ctx.user,
      });
    }),
});
