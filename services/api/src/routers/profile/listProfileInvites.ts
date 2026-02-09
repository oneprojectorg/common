import { listProfileUserInvites } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
  query: z.string().min(2).optional(),
});

const outputSchema = z.array(
  z.object({
    id: z.string(),
    email: z.string(),
    createdAt: z.string().nullable(),
  }),
);

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
        createdAt: invite.createdAt,
      }));
    }),
});
