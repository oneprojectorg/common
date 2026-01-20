import { updateProfileUserRoles } from '@op/common';
import { z } from 'zod';

import { profileUserEncoder } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const updateUserRolesRouter = router({
  updateUserRoles: commonAuthedProcedure()
    .input(
      z.object({
        profileUserId: z.uuid(),
        roleIds: z
          .array(z.uuid())
          .min(1, 'At least one role must be specified'),
      }),
    )
    .output(profileUserEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId, roleIds } = input;

      const result = await updateProfileUserRoles({
        profileUserId,
        roleIds,
        user,
      });

      return profileUserEncoder.parse(result);
    }),
});
