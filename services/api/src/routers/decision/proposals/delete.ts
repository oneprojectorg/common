import {
  Channels,
  deleteProposal as deleteProposalService,
  invalidateDecisionInstance,
} from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const deleteProposalRouter = router({
  deleteProposal: authenticatedProcedure({
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

      // Deletion changes the cached instance snapshot (proposalCount +
      // participantCount derive from non-draft proposals) and the submitters
      // face-pile, so drop every cached projection for this instance.
      waitUntil(invalidateDecisionInstance(result.processInstanceId));

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
