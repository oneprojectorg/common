import {
  Channels,
  assignPhaseReviews,
  instancePhaseRefSchema,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const assignReviewsInputSchema = instancePhaseRefSchema.extend({
  reviewerProfileId: z.uuid(),
  proposalIds: z.array(z.uuid()).min(1).max(500),
});

export const assignReviewsRouter = router({
  assignReviews: networkAuthenticatedProcedure()
    .input(assignReviewsInputSchema)
    .output(z.object({ createdCount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const createdCount = await assignPhaseReviews({
        ...input,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return { createdCount };
    }),
});
