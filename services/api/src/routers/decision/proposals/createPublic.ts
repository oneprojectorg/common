import { Channels, createPublicProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';

import { createProposalInputSchema } from '../../../encoders/decision';
import { authenticatedProcedure, router } from '../../../trpcFactory';

export const createPublicProposalRouter = router({
  /**
   * Creates a draft proposal on a public decision instance, ensuring the caller
   * is a participant first. Admits any session (including anonymous sign-ins).
   */
  createPublicProposal: authenticatedProcedure()
    .input(createProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await createPublicProposal({
        data: input,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.processInstanceId),
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalSchema.parse(proposal);
    }),
});
