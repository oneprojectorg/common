import { updateProfileUserRoles } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
});

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
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId, roleIds } = input;

      const result = await updateProfileUserRoles({
        profileUserId,
        roleIds,
        user,
      });

      return outputSchema.parse(result);
    }),
});
