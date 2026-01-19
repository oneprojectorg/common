import { updateProfileUserRoles } from '@op/common';
import { z } from 'zod';

import { updateProfileUserRolesInputSchema } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
});

export const updateUserRolesRouter = router({
  updateUserRoles: commonAuthedProcedure()
    .input(updateProfileUserRolesInputSchema)
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
