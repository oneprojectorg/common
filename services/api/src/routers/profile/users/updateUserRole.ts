import { updateProfileUserRoles } from '@op/common';
import { profileUserWithRolesSchema } from '@op/common/client';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const updateUserRolesRouter = router({
  updateUserRoles: commonNetworkProcedure()
    .input(
      z.object({
        profileUserId: z.uuid(),
        roleIds: z
          .array(z.uuid())
          .min(1, 'At least one role must be specified'),
      }),
    )
    .output(profileUserWithRolesSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId, roleIds } = input;

      const result = await updateProfileUserRoles({
        profileUserId,
        roleIds,
        user,
      });

      return profileUserWithRolesSchema.parse(result);
    }),
});
