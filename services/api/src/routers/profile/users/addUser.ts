import { addProfileUser } from '@op/common';
import { z } from 'zod';

import { addProfileUserInputSchema } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
  email: z.string(),
});

export const addUserRouter = router({
  addUser: commonAuthedProcedure()
    .input(addProfileUserInputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId, email, roleId, personalMessage } = input;

      const result = await addProfileUser({
        profileId,
        email,
        roleId,
        personalMessage,
        user,
      });

      return outputSchema.parse(result);
    }),
});
