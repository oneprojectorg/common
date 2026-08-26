import {
  Channels,
  instancePhaseRefSchema,
  removeReviewAssignment,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const removeReviewAssignmentInputSchema = instancePhaseRefSchema.extend({
  assignmentId: z.uuid(),
});

export const removeReviewAssignmentRouter = router({
  removeReviewAssignment: networkAuthenticatedProcedure()
    .input(removeReviewAssignmentInputSchema)
    .output(z.object({ removedCount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { removedCount } = await removeReviewAssignment({
        ...input,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return { removedCount };
    }),
});
