import {
  Channels,
  listProposalFeedback,
  proposalFeedbackListSchema,
} from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const listProposalFeedbackRouter = router({
  listProposalFeedback: authenticatedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
      }),
    )
    .output(proposalFeedbackListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listProposalFeedback({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // Phase transitions publish on `decisionInstance`, and phase end is
      // what releases feedback.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(result.processInstanceId),
        Channels.decisionInstance(result.processInstanceId),
      ]);

      return proposalFeedbackListSchema.parse(result);
    }),
});
