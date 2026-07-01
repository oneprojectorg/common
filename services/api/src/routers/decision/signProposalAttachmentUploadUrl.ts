import { signProposalAttachmentUploadUrl as signProposalAttachmentUploadUrlService } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

export const signProposalAttachmentUploadUrl = router({
  signProposalAttachmentUploadUrl: authenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
      }),
    )
    .output(
      z.object({
        storagePath: z.string(),
        signedUrl: z.string().url(),
        token: z.string(),
      }),
    )
    .mutation(({ input, ctx }) =>
      signProposalAttachmentUploadUrlService({ input, user: ctx.user }),
    ),
});
