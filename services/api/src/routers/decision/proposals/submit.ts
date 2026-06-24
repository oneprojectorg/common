import { invalidate } from '@op/cache';
import { Channels, submitProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { Events, safeInngestSend } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

const submitProposalInputSchema = z.object({
  proposalId: z.uuid(),
});

export const submitProposalRouter = router({
  submitProposal: authenticatedProcedure()
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

      // Send proposal submitted event for notification workflow. Best-effort:
      // notifications are nice-to-have, so a publish failure is logged but
      // never blocks the response. The async moderation event
      // (`content/submitted`) is durable — submitProposal writes it through
      // the transactional outbox.
      waitUntil(
        safeInngestSend({
          name: Events.proposalSubmitted.name,
          data: { proposalId: proposal.id },
        }),
      );

      return proposalSchema.parse(proposal);
    }),
});
