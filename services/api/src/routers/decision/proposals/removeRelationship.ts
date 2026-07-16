import {
  Channels,
  assertProposalEngagementAccess,
  removeProfileRelationship,
} from '@op/common';
import { ProfileRelationshipType } from '@op/db/schema';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

const removeProposalRelationshipInputSchema = z.object({
  targetProfileId: z.uuid(),
  relationshipType: z.enum([
    ProfileRelationshipType.FOLLOWING,
    ProfileRelationshipType.LIKES,
  ]),
});

export const removeProposalRelationshipRouter = router({
  /**
   * Unlike/unfollow a proposal. Counterpart of `addProposalRelationship` —
   * see that procedure for why this is confirmed-tier and proposal-only.
   */
  removeProposalRelationship: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(removeProposalRelationshipInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType } = input;

      const { proposalId, processInstanceId } =
        await assertProposalEngagementAccess({
          user: ctx.user,
          profileId: targetProfileId,
        });

      await removeProfileRelationship({
        targetProfileId,
        relationshipType,
        authUserId: ctx.user.id,
      });

      ctx.registerMutationChannels([
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);
    }),
});
