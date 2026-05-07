import { invalidate } from '@op/cache';
import { acceptDecisionInvite } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const acceptDecisionInviteRouter = router({
  acceptDecisionInvite: commonAuthedProcedure()
    .input(
      z.union([
        z.object({ profileId: z.string().uuid() }),
        z.object({ slug: z.string() }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      await acceptDecisionInvite({
        ...input,
        user: ctx.user,
      });

      waitUntil(invalidate({ type: 'user', params: [ctx.user.id] }));
    }),
});
