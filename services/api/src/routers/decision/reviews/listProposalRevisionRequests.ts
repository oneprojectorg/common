import {
  Channels,
  listProposalRevisionRequests,
  proposalRevisionRequestListSchema,
} from '@op/common';
import { ProposalReviewRequestState } from '@op/db/schema';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const listProposalRevisionRequestsRouter = router({
  listProposalRevisionRequests: authenticatedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
        states: z.array(z.enum(ProposalReviewRequestState)).optional(),
        phaseId: z.string().optional(),
      }),
    )
    .output(proposalRevisionRequestListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listProposalRevisionRequests({
        phaseId: input.phaseId,
        proposalId: input.proposalId,
        states: input.states,
        user: ctx.user,
      });

      ctx.registerQueryChannels([
        Channels.reviewAssignments(result.processInstanceId),
      ]);

      return proposalRevisionRequestListSchema.parse(result);
    }),
});
