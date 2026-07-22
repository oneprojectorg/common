import { invalidate } from '@op/cache';
import { Channels, submitProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

const submitProposalInputSchema = z.object({
  proposalId: z.uuid(),
});

export const submitProposalRouter = router({
  submitProposal: authenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(submitProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const proposal = await submitProposal({
        data: input,
        authUserId: user.id,
      });

      waitUntil(
        invalidate({
          type: 'decision',
          params: [proposal.processInstanceId, 'submitters'],
        }),
      );

      ctx.registerMutationChannels([
        Channels.decisionProposals(proposal.processInstanceId),
        Channels.decisionProposal(proposal.processInstanceId, proposal.id),
      ]);

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

      // Submit the proposal for async moderation review. The workflow
      // resolves the text (TipTap fragments + proposalData) and attachments
      // itself — proposalData alone is empty for collab-doc proposals.
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
