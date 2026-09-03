import {
  Channels,
  instancePhaseRefSchema,
  listPhaseReviewerSummaries,
} from '@op/common';
import { phaseReviewerSummariesSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listPhaseReviewerSummariesRouter = router({
  listPhaseReviewerSummaries: networkAuthenticatedProcedure()
    .input(instancePhaseRefSchema)
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
