import { Channels, saveReviewDraft } from '@op/common';
import {
  proposalReviewSchema,
  rubricReviewDataSchema,
} from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const saveReviewDraftInputSchema = z.object({
  assignmentId: z.uuid(),
  reviewData: rubricReviewDataSchema,
});

export const saveReviewDraftRouter = router({
  saveReviewDraft: commonAuthedProcedure()
    .input(saveReviewDraftInputSchema)
    .output(proposalReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await saveReviewDraft({
        assignmentId: input.assignmentId,
        reviewData: input.reviewData,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.reviewAssignments(result.processInstanceId),
      ]);

      return proposalReviewSchema.parse(result);
    }),
});
