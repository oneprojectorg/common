import {
  Channels,
  addProfileRelationship,
  assertProposalEngagementAccess,
} from '@op/common';
import { ProfileRelationshipType } from '@op/db/schema';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';
import {
  trackProposalFollowed,
  trackProposalLiked,
} from '../../../utils/analytics';

const addProposalRelationshipInputSchema = z.object({
  targetProfileId: z.uuid(),
  relationshipType: z.enum([
    ProfileRelationshipType.FOLLOWING,
    ProfileRelationshipType.LIKES,
  ]),
});

export const addProposalRelationshipRouter = router({
  /**
   * Like/follow a proposal. Separate from the generic (closed-network)
   * `profile.addRelationship`: proposal engagement is open to confirmed
   * out-of-network accounts — e.g. accounts claimed from a public decision
   * process — and is gated on the parent decision instead (SUBMIT_PROPOSALS,
   * the same bar commenting uses). Only proposal profiles are accepted.
   */
  addProposalRelationship: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(addProposalRelationshipInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType } = input;

      const { proposalId, processInstanceId } =
        await assertProposalEngagementAccess({
          user: ctx.user,
          profileId: targetProfileId,
        });

      await addProfileRelationship({
        targetProfileId,
        relationshipType,
        authUserId: ctx.user.id,
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
        })(),
      );
    }),
});
