import {
  Channels,
  instancePhaseRefSchema,
  listReviewAssignmentFieldFacets,
} from '@op/common';
import {
  reviewAssignmentFieldFacetsSchema,
  reviewAssignmentFieldFiltersSchema,
} from '@op/common/client';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewAssignmentFieldFacetsRouter = router({
  /**
   * Option counts for the reviewer's own queue — the numbers beside each
   * checkbox in the queue's filter panel.
   *
   * Takes the same filters as `listReviewAssignments` minus pagination and
   * sort, which cannot change a count.
   */
  listReviewAssignmentFieldFacets: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema.extend({
        status: z.enum(ProposalReviewAssignmentStatus).optional(),
        categoryIds: z.array(z.string()).optional(),
        /** Limits results to one proposal's assignments. */
        proposalProfileId: z.uuid().optional(),
        /**
         * The filters currently applied. Each key's counts ignore its own
         * filter, so the options of the key you are filtering on stay
         * selectable.
         */
        fieldFilters: reviewAssignmentFieldFiltersSchema.optional(),
      }),
    )
    .output(reviewAssignmentFieldFacetsSchema)
    .query(async ({ ctx, input }) => {
      // Assignment writes publish here, so the panel refetches on assign.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listReviewAssignmentFieldFacets({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        status: input.status,
        categoryIds: input.categoryIds,
        proposalProfileId: input.proposalProfileId,
        fieldFilters: input.fieldFilters,
        user: ctx.user,
      });
    }),
});
