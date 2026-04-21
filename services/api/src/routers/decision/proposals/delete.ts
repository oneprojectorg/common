import {
  Channels,
  deleteProposal as deleteProposalService,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const deleteProposalRouter = router({
  deleteProposal: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(
      z.object({
        proposalId: z.uuid(),
      }),
    )
    .output(
      z.object({
        deletedId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      const result = await deleteProposalService({
        proposalId: input.proposalId,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionProposals(result.processInstanceId),
        Channels.decisionProposal(result.processInstanceId, input.proposalId),
      ]);

      logger.info('Proposal deleted', {
        userId: user.id,
        proposalId: input.proposalId,
      });

      return { deletedId: result.deletedId };
    }),
});
