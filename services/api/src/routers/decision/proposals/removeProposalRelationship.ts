import {
  Channels,
  removeProposalRelationship as removeProposalRelationshipService,
} from '@op/common';

import { proposalRelationshipInputSchema } from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const removeProposalRelationshipRouter = router({
  /**
   * Unlike/unfollow a proposal. Counterpart of `addProposalRelationship` —
   * see that procedure for why this is confirmed-tier; the service asserts
   * the proposal-only engagement gate.
   */
  removeProposalRelationship: authenticatedConfirmedProcedure()
    .input(proposalRelationshipInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType } = input;

      const { proposalId, processInstanceId } =
        await removeProposalRelationshipService({
          user: ctx.user,
          targetProfileId,
          relationshipType,
        });

      ctx.registerMutationChannels([
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);
    }),
});
