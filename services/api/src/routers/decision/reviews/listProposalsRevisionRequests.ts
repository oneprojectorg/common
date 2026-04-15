import {
  Channels,
  listProposalsRevisionRequests,
  proposalRevisionRequestListSchema,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalsRevisionRequestsRouter = router({
  listProposalsRevisionRequests: commonAuthedProcedure()
    .input(
      z.object({
        proposalId: z.uuid().optional(),
      }),
    )
    .output(proposalRevisionRequestListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listProposalsRevisionRequests({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      ctx.registerQueryChannels(
        result.assignmentIds.map(Channels.reviewAssignment),
      );

      return proposalRevisionRequestListSchema.parse(result);
    }),
});
