import {
  Channels,
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
        dir: z.enum(['asc', 'desc']).optional(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).prefault(50),
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
        dir: input.dir,
        cursor: input.cursor,
        limit: input.limit,
        user: ctx.user,
      });
    }),
});
