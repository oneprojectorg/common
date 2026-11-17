import { invalidate } from '@op/cache';
import { Channels, unsubmitDevelopedProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { waitUntil } from '@vercel/functions';

import { submitProposalInputSchema } from '../../../encoders/decision';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const unsubmitDevelopedProposalRouter = router({
  unsubmitDevelopedProposal: networkAuthenticatedProcedure()
    .input(submitProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await unsubmitDevelopedProposal({
        data: input,
        user,
      });

      waitUntil(
        invalidate({
          type: 'decision',
          params: [proposal.processInstanceId, 'submitters:v2'],
        }),
      );

      ctx.registerMutationChannels([
        Channels.decisionProposals(proposal.processInstanceId),
        Channels.decisionProposal(proposal.processInstanceId, proposal.id),
      ]);

      return proposalSchema.parse(proposal);
    }),
});
