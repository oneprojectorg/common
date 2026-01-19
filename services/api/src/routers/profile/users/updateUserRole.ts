import { updateProfileUserRole } from '@op/common';
import { z } from 'zod';

import { updateProfileUserRoleInputSchema } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
});

export const updateUserRoleRouter = router({
  updateUserRole: commonAuthedProcedure()
    .input(updateProfileUserRoleInputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId, roleId } = input;

      const result = await updateProfileUserRole({
        profileUserId,
        roleId,
        user,
      });

      return outputSchema.parse(result);
    }),
});
