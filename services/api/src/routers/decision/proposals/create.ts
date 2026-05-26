import { Channels, createProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';

import { createProposalInputSchema } from '../../../encoders/decision';
import { processInstanceProcedure, router } from '../../../trpcFactory';

export const createProposalRouter = router({
  /** Creates a new proposal in draft status. Use submitProposal to transition to submitted. */
  createProposal: processInstanceProcedure({ requireUser: true })
    .input(createProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx: rawCtx, input }) => {
      const ctx = rawCtx as typeof rawCtx & {
        user: NonNullable<typeof rawCtx.user>;
      };
      const { user, skipAccessCheck } = ctx;

      const proposal = await createProposal({
        data: input,
        user,
        skipAccessCheck,
      });

      ctx.registerMutationChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalSchema.parse(proposal);
    }),
});
