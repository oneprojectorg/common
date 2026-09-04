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
        /** Omit for all phases. */
        phaseId: z.string().optional(),
        status: z.enum(ProposalReviewAssignmentStatus).optional(),
        categoryIds: z.array(z.string()).optional(),
        /** Limits results to one proposal's assignments. */
        proposalProfileId: z.uuid().optional(),
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
        phaseId: input.phaseId,
        status: input.status,
        categoryIds: input.categoryIds,
        proposalProfileId: input.proposalProfileId,
        sort: input.sort,
        user: ctx.user,
      });
    }),
});
