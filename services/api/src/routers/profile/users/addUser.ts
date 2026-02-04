import { addProfileUser } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

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
    .output(
      z.object({
        email: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId, inviteeEmail, roleIdsToAssign, personalMessage } =
        input;

      return addProfileUser({
        profileId,
        inviteeEmail,
        roleIdsToAssign,
        personalMessage,
        currentUser: user,
      });
    }),
});
