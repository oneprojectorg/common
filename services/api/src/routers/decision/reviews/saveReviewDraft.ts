import { Channels, saveReviewDraft } from '@op/common';
import {
  proposalReviewSchema,
  rubricReviewDataSchema,
} from '@op/common/client';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

const saveReviewDraftInputSchema = z.object({
  assignmentId: z.uuid(),
  reviewData: rubricReviewDataSchema,
  overallComment: z.string().nullable().optional(),
});

export const saveReviewDraftRouter = router({
  saveReviewDraft: commonNetworkProcedure()
    .input(saveReviewDraftInputSchema)
    .output(proposalReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const { review, processInstanceId } = await saveReviewDraft({
        assignmentId: input.assignmentId,
        reviewData: input.reviewData,
        overallComment: input.overallComment,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.reviewAssignments(processInstanceId),
      ]);

      return proposalReviewSchema.parse(review);
    }),
});
