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

      ctx.registerQueryChannels([
        Channels.reviewAssignments(result.processInstanceId),
      ]);

      return proposalFeedbackListSchema.parse(result);
    }),
});
