import { addProfileUser } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
  email: z.string(),
});

export const addUserRouter = router({
  addUser: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
        inviteeEmail: z.string().email(),
        roleIdsToAssign: z
          .array(z.uuid())
          .min(1, 'At least one role must be specified'),
        personalMessage: z.string().optional(),
      }),
    )
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId, inviteeEmail, roleIdsToAssign, personalMessage } = input;

      const result = await addProfileUser({
        profileId,
        inviteeEmail,
        roleIdsToAssign,
        personalMessage,
        currentUser: user,
      });

      return outputSchema.parse(result);
    }),
});
