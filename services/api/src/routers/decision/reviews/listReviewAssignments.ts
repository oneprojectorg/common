import {
  Channels,
  listReviewAssignments,
  reviewAssignmentListSchema,
} from '@op/common';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const listReviewAssignmentsRouter = router({
  listReviewAssignments: commonNetworkProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        status: z.enum(ProposalReviewAssignmentStatus).optional(),
        dir: z.enum(['asc', 'desc']).optional(),
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
        user: ctx.user,
      });
    }),
});
