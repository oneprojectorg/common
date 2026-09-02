import {
  Channels,
  getPhaseReviewAssignments,
  instancePhaseRefSchema,
} from '@op/common';
import { adminDecisionReviewAssignmentsSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

// Preview text costs one Tiptap request per proposal, so it is opt-in per
// reviewer: only the reviewer detail screen renders it, and it passes its own
// profile id here. The phase-wide reviewer table asks for none.
const listPhaseReviewAssignmentsInput = instancePhaseRefSchema.extend({
  reviewerProfileId: z.uuid().optional(),
});

export const listPhaseReviewAssignmentsRouter = router({
  listPhaseReviewAssignments: networkAuthenticatedProcedure()
    .input(listPhaseReviewAssignmentsInput)
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
