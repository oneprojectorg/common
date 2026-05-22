import { getLatestSelectionForProposal } from '@op/common';
import { proposalSelectionSchema } from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getLatestSelectionForProposalRouter = router({
  getLatestSelectionForProposal: commonAuthedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
      }),
    )
    .output(proposalSelectionSchema.nullable())
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { proposalId } = input;

      return getLatestSelectionForProposal({
        proposalId,
        user,
      });
    }),
});
