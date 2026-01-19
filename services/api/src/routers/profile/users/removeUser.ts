import { removeProfileUser } from '@op/common';
import { z } from 'zod';

import { removeProfileUserInputSchema } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
});

export const removeUserRouter = router({
  removeUser: commonAuthedProcedure()
    .input(removeProfileUserInputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId } = input;

      const result = await removeProfileUser({
        profileUserId,
        user,
      });

      return outputSchema.parse(result);
    }),
});
