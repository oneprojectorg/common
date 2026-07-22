import { invalidate } from '@op/cache';
import { Channels, updateProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { ProposalStatus } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { updateProposalInputSchema } from '../../../encoders/decision';
import { authenticatedProcedure, router } from '../../../trpcFactory';

export const updateProposalRouter = router({
  updateProposal: authenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(
      z.object({
        proposalId: z.uuid(),
        data: updateProposalInputSchema,
      }),
    )
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { proposalId } = input;

      const proposal = await updateProposal({
        proposalId,
        data: input.data,
        user,
      });

      await invalidate({
        type: 'profile',
        params: [proposal.profileId],
      });

      ctx.registerMutationChannels([
        Channels.decisionProposals(proposal.processInstanceId),
        Channels.decisionProposal(proposal.processInstanceId, input.proposalId),
      ]);

      // Re-run async moderation on edits to already-submitted proposals.
      // Drafts are moderated when they're first submitted (see submit.ts), so
      // editing a draft skips this to avoid reviewing not-yet-public content.
      if (proposal.status !== ProposalStatus.DRAFT) {
        waitUntil(
          inngest.send({
            name: Events.contentSubmitted.name,
            data: {
              itemType: 'proposal',
              itemId: proposal.id,
            },
          }),
        );
      }

      return proposalSchema.parse(proposal);
    }),
});
