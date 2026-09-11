import { Channels, cancelRevisionRequest } from '@op/common';
import { proposalReviewRequestSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const cancelRevisionRequestRouter = router({
  cancelRevisionRequest: networkAuthenticatedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
        revisionRequestId: z.uuid(),
      }),
    )
    .output(proposalReviewRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await cancelRevisionRequest({
        assignmentId: input.assignmentId,
        revisionRequestId: input.revisionRequestId,
        user: ctx.user,
      });

      // Every assignment of the proposal, not only the acting one: a request
      // changes the count the proposal's other reviewers see.
      ctx.registerMutationChannels([
        ...result.proposalAssignmentIds.map((assignmentId) =>
          Channels.reviewAssignment(assignmentId),
        ),
        Channels.reviewAssignments(result.processInstanceId),
        Channels.decisionProposal(result.processInstanceId, result.proposalId),
      ]);

      return proposalReviewRequestSchema.parse(result);
    }),
});
