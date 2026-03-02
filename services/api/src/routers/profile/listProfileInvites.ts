import { listProfileUserInvites } from '@op/common';
import { z } from 'zod';

import { profileInviteEncoder } from '../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
  query: z.string().min(2).optional(),
});

const outputSchema = z.array(profileInviteEncoder);

export const listProfileInvitesRouter = router({
  listProfileInvites: commonAuthedProcedure()
    .input(inputSchema)
    .output(outputSchema)
    .query(async ({ ctx, input }) => {
      const invites = await listProfileUserInvites({
        profileId: input.profileId,
        user: ctx.user,
        query: input.query,
      });

      return invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        accessRoleId: invite.accessRoleId,
        createdAt: invite.createdAt,
        inviteeProfile: invite.inviteeProfile ?? null,
      }));
    }),
});
