import { Channels, mergeProposals } from '@op/common';
import { mergeProposalsInputSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const mergeProposalsRouter = router({
  /**
   * Link one proposal into another as `merged`: nothing is combined and no status
   * changes, but the source drops out of listings, selection, and review.
   * Closed-network + `decisions: ADMIN`. Distinct from `addProposalRelationship`
   * (proposal like/follow).
   */
  mergeProposals: networkAuthenticatedProcedure()
    .input(mergeProposalsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        processInstanceId,
        sourceProposalId,
        targetProposalId,
        relationshipId,
      } = await mergeProposals({
        sourceProposalId: input.sourceProposalId,
        targetProposalId: input.targetProposalId,
        note: input.note,
        user: ctx.user,
      });

      // The source leaves every list and the target gains a relationship.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, sourceProposalId),
        Channels.decisionProposal(processInstanceId, targetProposalId),
      ]);

      // Tell the source proposal's authors their work was merged away. The
      // workflow resolves recipients itself so an unmerge landing first cancels
      // the notification.
      waitUntil(
        inngest.send({
          name: Events.proposalMerged.name,
          data: { relationshipId, actorAuthUserId: ctx.user.id },
        }),
      );
    }),
});
