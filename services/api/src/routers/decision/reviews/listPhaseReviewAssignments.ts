import {
  Channels,
  getPhaseReviewAssignments,
  instancePhaseRefSchema,
} from '@op/common';
import { adminDecisionReviewAssignmentsSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listPhaseReviewAssignmentsRouter = router({
  listPhaseReviewAssignments: networkAuthenticatedProcedure()
    .input(instancePhaseRefSchema)
    .output(adminDecisionReviewAssignmentsSchema)
    .query(async ({ ctx, input }) => {
      // Assignment writes publish here, so the desk refetches on assign.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await getPhaseReviewAssignments({
        ...input,
        user: ctx.user,
      });
    }),
});
