import { Channels, requestRevision } from '@op/common';
import { proposalReviewRequestSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const requestRevisionRouter = router({
  requestRevision: networkAuthenticatedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
        requestComment: z.string().min(1),
      }),
    )
    .output(proposalReviewRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await requestRevision({
        assignmentId: input.assignmentId,
        requestComment: input.requestComment,
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

      // Send revision requested event for notification workflow
      waitUntil(
        inngest.send({
          name: Events.reviewRevisionRequested.name,
          data: {
            assignmentId: input.assignmentId,
            revisionRequestId: result.id,
          },
        }),
      );

      return proposalReviewRequestSchema.parse(result);
    }),
});
