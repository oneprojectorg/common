import { submitProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

const submitProposalInputSchema = z.object({
  proposalId: z.uuid(),
});

export const submitProposalRouter = router({
  submitProposal: commonAuthedProcedure()
    .input(submitProposalInputSchema)
    .output(proposalSchema)
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

      // Send proposal submitted event for notification workflow
      waitUntil(
        inngest.send({
          name: Events.proposalSubmitted.name,
          data: { proposalId: proposal.id },
        }),
      );

      return proposalSchema.parse(proposal);
    }),
});
