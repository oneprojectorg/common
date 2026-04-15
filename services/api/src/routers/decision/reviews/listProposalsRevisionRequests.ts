import {
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
      return await listProposalsRevisionRequests({
        proposalId: input.proposalId,
        user: ctx.user,
      });
    }),
});
