import { addProfileUser } from '@op/common';
import { z } from 'zod';

import { profileUserEncoder } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

// Discriminated union: either a user was added directly, or an invite was sent
const outputSchema = z.discriminatedUnion('invited', [
  z.object({
    profileUser: profileUserEncoder,
    invited: z.literal(false),
  }),
  z.object({
    email: z.string(),
    invited: z.literal(true),
  }),
]);

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
      const { profileId, inviteeEmail, roleIdsToAssign, personalMessage } =
        input;

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
