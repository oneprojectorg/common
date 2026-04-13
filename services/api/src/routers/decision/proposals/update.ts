import { invalidate } from '@op/cache';
import { Channels, updateProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { z } from 'zod';

import { updateProposalInputSchema } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const updateProposalRouter = router({
  updateProposal: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.uuid(),
        data: updateProposalInputSchema,
      }),
    )
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { proposalId } = input;

      const proposal = await updateProposal({
        proposalId,
        data: input.data,
        user,
      });

      await invalidate({
        type: 'profile',
        params: [proposal.profileId],
      });

      ctx.registerMutationChannels([
        Channels.decisionProposals(proposal.processInstanceId),
        Channels.decisionProposal(proposal.processInstanceId, input.proposalId),
      ]);

      return proposalSchema.parse(proposal);
    }),
});
