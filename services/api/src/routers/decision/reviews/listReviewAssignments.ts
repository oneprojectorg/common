import {
  Channels,
  REVIEW_ASSIGNMENT_SORTS,
  listReviewAssignments,
  reviewAssignmentListSchema,
} from '@op/common';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewAssignmentsRouter = router({
  listReviewAssignments: networkAuthenticatedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        status: z.enum(ProposalReviewAssignmentStatus).optional(),
        sort: z.enum(REVIEW_ASSIGNMENT_SORTS).optional(),
      }),
    )
    .output(reviewAssignmentListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listReviewAssignments({
        processInstanceId: input.processInstanceId,
        status: input.status,
        sort: input.sort,
        user: ctx.user,
      });
    }),
});
