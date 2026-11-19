import { Channels, instancePhaseRefSchema, listPhaseReviews } from '@op/common';
import {
  PHASE_REVIEW_STATES,
  phaseReviewFiltersSchema,
  phaseReviewListSchema,
} from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { paginationSchema } from '../../../utils';

export const listPhaseReviewsRouter = router({
  listPhaseReviews: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema
        .extend({
          /**
           * `criterionKey -> option ids`. ANY-OF within a key, AND across
           * keys. Keys the phase's rubric does not offer as a choice
           * criterion are ignored, not rejected.
           */
          filters: phaseReviewFiltersSchema.optional(),
          state: z.enum(PHASE_REVIEW_STATES).optional(),
        })
        .merge(paginationSchema),
    )
    .output(phaseReviewListSchema)
    .query(async ({ ctx, input }) => {
      // Review writes publish here, so the list refetches on submit.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listPhaseReviews({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        filters: input.filters,
        state: input.state,
        cursor: input.cursor,
        limit: input.limit,
        user: ctx.user,
      });
    }),
});
