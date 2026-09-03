import {
  Channels,
  instancePhaseRefSchema,
  listReviewerAssignments,
} from '@op/common';
import { reviewerAssignmentsSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewerAssignmentsRouter = router({
  listReviewerAssignments: networkAuthenticatedProcedure()
    .input(instancePhaseRefSchema.extend({ reviewerProfileId: z.uuid() }))
    .output(reviewerAssignmentsSchema)
    .query(async ({ ctx, input }) => {
      // Assignment writes publish here, so the queue refetches on assign.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listReviewerAssignments({
        ...input,
        user: ctx.user,
      });
    }),
});
