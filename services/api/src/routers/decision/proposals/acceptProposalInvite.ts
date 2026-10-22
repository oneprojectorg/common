import { acceptProposalInvite } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const acceptProposalInviteRouter = router({
  acceptProposalInvite: networkAuthenticatedProcedure()
    .input(z.object({ profileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await acceptProposalInvite({
        profileId: input.profileId,
        user: ctx.user,
      });
    }),
});
