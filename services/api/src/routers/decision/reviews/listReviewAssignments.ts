import {
  Channels,
  REVIEW_ASSIGNMENT_SORTS,
  instancePhaseRefSchema,
  listReviewAssignments,
  reviewAssignmentListSchema,
} from '@op/common';
import { reviewAssignmentFieldFiltersSchema } from '@op/common/client';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { paginationSchema } from '../../../utils';

export const listReviewAssignmentsRouter = router({
  listReviewAssignments: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema
        .extend({
          status: z.enum(ProposalReviewAssignmentStatus).optional(),
          categoryIds: z.array(z.string()).optional(),
          /** Limits results to one proposal's assignments. */
          proposalProfileId: z.uuid().optional(),
          sort: z.enum(REVIEW_ASSIGNMENT_SORTS).optional(),
          /**
           * Rubric answer filters on each assignment's own review: criterion
           * key to option ids, ANY-OF within a key and AND across keys. An
           * assignment with no review row matches no filter.
           */
          fieldFilters: reviewAssignmentFieldFiltersSchema.optional(),
        })
        .merge(paginationSchema),
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
        fieldFilters: input.fieldFilters,
        sort: input.sort,
        cursor: input.cursor,
        limit: input.limit,
        user: ctx.user,
      });
    }),
});
