import { deleteProposalAttachment as deleteProposalAttachmentService } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const deleteProposalAttachment = router({
  deleteProposalAttachment: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        attachmentId: z.string(),
        proposalId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await deleteProposalAttachmentService({
        attachmentId: input.attachmentId,
        proposalId: input.proposalId,
        user: ctx.user,
      });
    }),
});
