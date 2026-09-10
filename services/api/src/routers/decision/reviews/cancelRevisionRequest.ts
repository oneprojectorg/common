import {
  cancelRevisionRequest,
  getAssignmentRevisionChannels,
} from '@op/common';
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

      ctx.registerMutationChannels(
        await getAssignmentRevisionChannels(input.assignmentId),
      );

      return proposalReviewRequestSchema.parse(result);
    }),
});
