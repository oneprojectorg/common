import {
  Channels,
  instancePhaseRefSchema,
  listPhaseReviewerSummaries,
} from '@op/common';
import { phaseReviewerSummariesSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listPhaseReviewerSummariesRouter = router({
  listPhaseReviewerSummaries: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema.extend({
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).optional(),
      }),
    )
    .output(phaseReviewerSummariesSchema)
    .query(async ({ ctx, input }) => {
      // Assignment writes publish here, so the table refetches on assign.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listPhaseReviewerSummaries({
        ...input,
        user: ctx.user,
      });
    }),
});
