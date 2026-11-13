import { invalidate } from '@op/cache';
import { Channels, submitDevelopedProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';

import { submitProposalInputSchema } from '../../../encoders/decision';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

export const submitDevelopedProposalRouter = router({
  submitDevelopedProposal: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(submitProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await submitDevelopedProposal({
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

      waitUntil(
        trackProposalSubmitted(ctx, proposal.processInstanceId, proposal.id, {
          created_timestamp: Date.now(),
        }),
      );

      waitUntil(
        inngest.send({
          name: Events.proposalSubmitted.name,
          data: { proposalId: proposal.id },
        }),
      );

      waitUntil(
        inngest.send({
          name: Events.contentSubmitted.name,
          data: {
            itemType: 'proposal',
            itemId: proposal.id,
          },
        }),
      );

      return proposalSchema.parse(proposal);
    }),
});
