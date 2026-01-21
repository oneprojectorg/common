import { removeProfileUser } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  id: z.string(),
  authUserId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  about: z.string().nullable(),
  profileId: z.string(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
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
