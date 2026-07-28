import {
  Channels,
  addProposalRelationship as addProposalRelationshipService,
} from '@op/common';
import { ProfileRelationshipType } from '@op/db/schema';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';

import { proposalRelationshipInputSchema } from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';
import {
  trackProposalFollowed,
  trackProposalLiked,
} from '../../../utils/analytics';

export const addProposalRelationshipRouter = router({
  /**
   * Like/follow a proposal. Separate from the generic (closed-network)
   * `profile.addRelationship`: proposal engagement is open to confirmed
   * out-of-network accounts — e.g. accounts claimed from a public decision
   * process. The service asserts the gate: only proposal targets, requiring
   * SUBMIT_PROPOSALS on the parent decision, the same permission commenting
   * requires.
   */
  addProposalRelationship: authenticatedConfirmedProcedure()
    .input(proposalRelationshipInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType } = input;

      const { proposalId, processInstanceId } =
        await addProposalRelationshipService({
          user: ctx.user,
          targetProfileId,
          relationshipType,
        });

      // The proposal detail query subscribes to this channel; registering it
      // refreshes engagement counts (likesCount, followersCount) immediately.
      // Deliberately scoped to the single proposal — invalidating the whole
      // `decisionProposals` list channel for every like/follow would force
      // every viewer to re-fetch every card.
      ctx.registerMutationChannels([
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);

      waitUntil(
        (async () => {
          if (relationshipType === ProfileRelationshipType.LIKES) {
            await trackProposalLiked(ctx, processInstanceId, proposalId);
          } else if (relationshipType === ProfileRelationshipType.FOLLOWING) {
            await trackProposalFollowed(ctx, processInstanceId, proposalId);
          }
        })().catch((error) => {
          logger.error('Proposal engagement analytics failed', { error });
        }),
      );
    }),
});
