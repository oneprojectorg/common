import { Channels, createProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';

import { createProposalInputSchema } from '../../../encoders/decision';
import { authenticatedProcedure, router } from '../../../trpcFactory';

export const createProposalRouter = router({
  /** Creates a new proposal in draft status. Use submitProposal to transition to submitted. */
  createProposal: authenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(createProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await createProposal({
        data: input,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalSchema.parse(proposal);
    }),
});
