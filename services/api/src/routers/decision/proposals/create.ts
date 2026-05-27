import { Channels, UnauthorizedError, createProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';

import { createProposalInputSchema } from '../../../encoders/decision';
import { commonOpenProcedure, router } from '../../../trpcFactory';

export const createProposalRouter = router({
  /** Creates a new proposal in draft status. Use submitProposal to transition to submitted. */
  createProposal: commonOpenProcedure()
    .input(createProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, accessUser } = ctx.authContext;

      // Gate at the boundary: createProposal writes a proposal-owner row
      // keyed to the real user's id. No-JWT callers don't have one.
      if (!user) {
        throw new UnauthorizedError('Authenticated session required');
      }

      const proposal = await createProposal({
        data: input,
        user,
        accessUser,
      });

      ctx.registerMutationChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalSchema.parse(proposal);
    }),
});
