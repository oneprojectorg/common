import { Channels, updateProfileInvite } from '@op/common';
import { z } from 'zod';

import { profileInviteEncoder } from '../../encoders/profiles';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const updateProfileInviteRouter = router({
  updateProfileInvite: networkAuthenticatedProcedure()
    .input(
      z.object({
        inviteId: z.string().uuid(),
        accessRoleId: z.string().uuid(),
      }),
    )
    .output(profileInviteEncoder)
    .mutation(async ({ ctx, input }) => {
      const invite = await updateProfileInvite({
        inviteId: input.inviteId,
        accessRoleId: input.accessRoleId,
        user: ctx.user,
      });

      // Changing an invite's role moves it between role tabs, so both
      // tabs' counts move.
      ctx.registerMutationChannels([Channels.profileMembers(invite.profileId)]);

      return {
        id: invite.id,
        email: invite.email,
        accessRoleId: invite.accessRoleId,
        createdAt: invite.createdAt,
        notifiedAt: invite.notifiedAt,
        inviteeProfile: invite.inviteeProfile,
      };
    }),
});
