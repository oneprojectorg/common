import {
  Channels,
  listProposalRevisionRequests,
  proposalRevisionRequestListSchema,
} from '@op/common';
import { ProposalReviewRequestState } from '@op/db/schema';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listProposalRevisionRequestsRouter = router({
  listProposalRevisionRequests: networkAuthenticatedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
        states: z.array(z.enum(ProposalReviewRequestState)).optional(),
      }),
    )
    .output(proposalRevisionRequestListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listProposalRevisionRequests({
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
