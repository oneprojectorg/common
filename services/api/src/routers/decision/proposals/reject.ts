import { Channels, rejectProposal } from '@op/common';
import { rejectProposalInputSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const rejectProposalRouter = router({
  /**
   * Move a proposal to `REJECTED`. Closed-network + `decisions: ADMIN`.
   *
   * The status change stops the proposal advancing through phases, being
   * reviewed, and being votable; it stays listed and readable, badged with its
   * status.
   */
  rejectProposal: networkAuthenticatedProcedure()
    .input(rejectProposalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId, proposalId } = await rejectProposal({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // The status change moves it off the ballot and out of review.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);

      // Nothing stores the reason or the note, so the event carries both. The
      // workflow re-checks the rejection still stands, so an undo cancels it.
      waitUntil(
        inngest.send({
          name: Events.proposalRejected.name,
          data: {
            proposalId,
            reason: input.reason,
            note: input.note,
            actorAuthUserId: ctx.user.id,
          },
        }),
      );
    }),
});
