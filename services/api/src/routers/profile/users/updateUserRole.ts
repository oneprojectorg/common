import { Channels, updateProfileUserRoles } from '@op/common';
import { profileUserWithRolesSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const updateUserRolesRouter = router({
  updateUserRoles: networkAuthenticatedProcedure()
    .input(
      z.object({
        profileUserId: z.uuid(),
        roleIds: z
          .array(z.uuid())
          .min(1, 'At least one role must be specified'),
      }),
    )
    .output(profileUserWithRolesSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId, roleIds } = input;

      const result = await updateProfileUserRoles({
        profileUserId,
        roleIds,
        user,
      });

      const profileUser = profileUserWithRolesSchema.parse(result);

      // A role change moves one member between two role counts.
      ctx.registerMutationChannels([
        Channels.profileMembers(profileUser.profileId),
      ]);

      return profileUser;
    }),
});
