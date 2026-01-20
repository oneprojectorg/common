import { removeProfileUser } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
});

export const removeUserRouter = router({
  removeUser: commonAuthedProcedure()
    .input(z.object({ profileUserId: z.uuid() }))
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
