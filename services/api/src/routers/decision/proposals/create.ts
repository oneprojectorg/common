import { createProposal } from '@op/common';

import {
  createProposalInputSchema,
  proposalEncoder,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const createProposalRouter = router({
  /** Creates a new proposal in draft status. Use submitProposal to transition to submitted. */
  createProposal: commonAuthedProcedure()
    .input(createProposalInputSchema)
    .output(proposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await createProposal({
        data: input,
        user,
      });

      return proposalEncoder.parse(proposal);
    }),
});
