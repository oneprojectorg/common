import {
  Channels,
  listProposalsRevisionRequests,
  proposalRevisionRequestListSchema,
} from '@op/common';
import { ProposalReviewRequestState } from '@op/db/schema';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listProposalsRevisionRequestsRouter = router({
  listProposalsRevisionRequests: networkAuthenticatedProcedure()
    .input(
      z.object({
        states: z.array(z.enum(ProposalReviewRequestState)).optional(),
      }),
    )
    .output(proposalRevisionRequestListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listProposalsRevisionRequests({
        states: input.states,
        user: ctx.user,
      });

      ctx.registerQueryChannels(
        result.processInstanceIds.map(Channels.reviewAssignments),
      );

      return proposalRevisionRequestListSchema.parse(result);
    }),
});
