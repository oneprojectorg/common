import { deleteProposalAttachment as deleteProposalAttachmentService } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deleteProposalAttachment = router({
  deleteProposalAttachment: commonAuthedProcedure({
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
