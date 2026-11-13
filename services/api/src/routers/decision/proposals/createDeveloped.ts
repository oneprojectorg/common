import { Channels, createDevelopedProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';

import { createDevelopedProposalInputSchema } from '../../../encoders/decision';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const createDevelopedProposalRouter = router({
  /** Creates a draft proposal developed from source proposals. Use submitDevelopedProposal to submit it. */
  createDevelopedProposal: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(createDevelopedProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await createDevelopedProposal({
        data: input,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionProposals(input.processInstanceId),
        ...input.sourceProposalIds.map((sourceProposalId) =>
          Channels.decisionProposal(input.processInstanceId, sourceProposalId),
        ),
      ]);

      return proposalSchema.parse(proposal);
    }),
});
