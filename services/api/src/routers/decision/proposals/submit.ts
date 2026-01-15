import { submitProposal } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { legacyProposalEncoder } from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

const submitProposalInputSchema = z.object({
  proposalId: z.uuid(),
  proposalData: z.record(z.string(), z.unknown()),
  attachmentIds: z.array(z.string()).optional(),
});

export const submitProposalRouter = router({
  submitProposal: commonAuthedProcedure()
    .input(submitProposalInputSchema)
    .output(legacyProposalEncoder)
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

      return legacyProposalEncoder.parse(proposal);
    }),
});
