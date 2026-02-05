import { addProfileUser } from '@op/common';
import { z } from 'zod';

import { profileUserEncoder } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const addUserRouter = router({
  addUser: commonAuthedProcedure({
    rateLimit: { windowSize: 30, maxRequests: 10 },
  })
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
      z.discriminatedUnion('invited', [
        z.object({
          profileUser: profileUserEncoder,
          invited: z.literal(false),
        }),
        z.object({
          email: z.string(),
          invited: z.literal(true),
        }),
      ]),
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
