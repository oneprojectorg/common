import {
  CommonError,
  uploadProposalAttachment as uploadProposalAttachmentService,
} from '@op/common';
import { db } from '@op/db/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { MAX_FILE_SIZE } from '../../utils';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4',
];

export const uploadProposalAttachment = router({
  uploadProposalAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        path: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number().int().nonnegative(),
        proposalId: z.string(),
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
    .mutation(async ({ input, ctx }) => {
      const { path, fileName, mimeType, fileSize, proposalId } = input;
      const { user } = ctx;

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new CommonError(
          'Unsupported file type. Allowed: PNG, JPEG, GIF, WebP, MP4, PDF, DOCX, XLSX.',
        );
      }

      if (fileSize > MAX_FILE_SIZE) {
        throw new CommonError(
          `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }

      const storageObject = await db.query.objectsInStorage.findFirst({
        where: {
          bucketId: 'assets',
          name: path,
        },
      });

      if (!storageObject) {
        throw new CommonError('Uploaded file not found in storage');
      }

      const result = await uploadProposalAttachmentService({
        input: {
          fileName,
          mimeType,
          fileSize,
          storageObjectId: storageObject.id,
          proposalId,
        },
        user,
      });

      return {
        id: result.id,
        fileName: result.fileName,
        mimeType: result.mimeType,
        fileSize: result.fileSize,
      };
    }),
});
