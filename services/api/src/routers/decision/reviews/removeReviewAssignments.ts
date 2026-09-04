import {
  Channels,
  instancePhaseRefSchema,
  removeReviewAssignments,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const removeReviewAssignmentsInputSchema = instancePhaseRefSchema.extend({
  assignmentIds: z.uuid().array().min(1).max(500),
});

export const removeReviewAssignmentsRouter = router({
  removeReviewAssignments: networkAuthenticatedProcedure()
    .input(removeReviewAssignmentsInputSchema)
    .output(
      z.object({
        removedCount: z.number(),
        skippedIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await removeReviewAssignments({
        ...input,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return result;
    }),
});
