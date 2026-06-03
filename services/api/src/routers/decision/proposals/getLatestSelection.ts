import { getLatestSelectionForProposal } from '@op/common';
import { proposalSelectionSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getLatestSelectionForProposalRouter = router({
  getLatestSelectionForProposal: networkAuthenticatedProcedure()
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
