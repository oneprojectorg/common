import { invalidate } from '@op/cache';
import {
  Channels,
  deleteProposal as deleteProposalService,
  notifyProposalCorpusChanged,
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

      waitUntil(
        invalidate({
          type: 'decision',
          params: [result.processInstanceId, 'submitters'],
        }),
      );

      ctx.registerMutationChannels([
        Channels.decisionProposals(result.processInstanceId),
        Channels.decisionProposal(result.processInstanceId, input.proposalId),
      ]);

      // Deletion has no event of its own, so this is the only signal the theme
      // analysis gets that its corpus shrank.
      waitUntil(
        notifyProposalCorpusChanged({
          processInstanceId: result.processInstanceId,
        }),
      );

      logger.info('Proposal deleted', {
        userId: user.id,
        proposalId: input.proposalId,
      });

      return { deletedId: result.deletedId };
    }),
});
