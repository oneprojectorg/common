import {
  ALLOWED_UPLOAD_MIME_TYPES,
  uploadProposalAttachment as uploadProposalAttachmentService,
} from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

const allowedMimeSchema = z.enum(ALLOWED_UPLOAD_MIME_TYPES);

export const uploadProposalAttachment = router({
  uploadProposalAttachment: authenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        // Storage path returned by `signProposalAttachmentUploadUrl`; the
        // client PUTs the file directly to Supabase, then calls this to
        // record the attachment.
        storagePath: z.string().min(1).max(1024),
        fileName: z.string().min(1).max(255),
        mimeType: allowedMimeSchema,
        proposalId: z.string().uuid(),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      }),
    )
    .mutation(({ input, ctx }) =>
      uploadProposalAttachmentService({ input, user: ctx.user }),
    ),
});
