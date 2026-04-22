import {
  Channels,
  listAllReviewAssignments,
  reviewItemListSchema,
} from '@op/common';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listAllReviewAssignmentsRouter = router({
  listAllReviewAssignments: commonAuthedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        status: z.enum(ProposalReviewAssignmentStatus).optional(),
        dir: z.enum(['asc', 'desc']).optional(),
      }),
    )
    .output(reviewItemListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listAllReviewAssignments({
        processInstanceId: input.processInstanceId,
        status: input.status,
        dir: input.dir,
        user: ctx.user,
      });
    }),
});
