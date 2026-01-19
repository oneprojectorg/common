import { submitProposal } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { proposalEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

const submitProposalInputSchema = z.object({
  proposalId: z.uuid(),
});

export const submitProposalRouter = router({
  /** Submits a draft proposal, transitioning it to 'submitted' status after validation. */
  submitProposal: commonAuthedProcedure()
    .input(submitProposalInputSchema)
    .output(proposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await submitProposal({
        data: input,
        authUserId: user.id,
      });

      // Fire analytics after successful submission
      waitUntil(
        trackProposalSubmitted(ctx, proposal.processInstanceId, proposal.id, {
          created_timestamp: Date.now(),
        }),
      );

      return proposalEncoder.parse(proposal);
    }),
});
