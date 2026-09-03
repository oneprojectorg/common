import {
  Channels,
  getReviewerAssignmentPool,
  instancePhaseRefSchema,
} from '@op/common';
import { reviewerAssignmentPoolSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getReviewerAssignmentPoolRouter = router({
  getReviewerAssignmentPool: networkAuthenticatedProcedure()
    .input(instancePhaseRefSchema.extend({ reviewerProfileId: z.uuid() }))
    .output(reviewerAssignmentPoolSchema)
    .query(async ({ ctx, input }) => {
      // Assignment writes publish here, so the dialog refetches on assign.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await getReviewerAssignmentPool({
        ...input,
        user: ctx.user,
      });
    }),
});
