import {
  Channels,
  listProposalsRevisionRequests,
  proposalRevisionRequestListSchema,
} from '@op/common';
import { ProposalReviewRequestState } from '@op/db/schema';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const listProposalsRevisionRequestsRouter = router({
  listProposalsRevisionRequests: commonNetworkProcedure()
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
