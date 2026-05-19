import { CommonError, getCurrentProfileId } from '@op/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { sanitizeS3Filename } from '../../utils';
import {
  STORAGE_BUCKET,
  createSignedUploadUrl,
  createStorageAdmin,
  findUploadedStorageObject,
  scheduleStorageObjectCleanup,
  validateMimeAndSize,
  validateStoragePath,
} from '../../utils/storage';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const UNSUPPORTED_MESSAGE =
  'Unsupported file type. Only images (PNG, JPEG, GIF, WebP) and PDFs are allowed.';

export const uploadPostAttachment = router({
  createPostAttachmentUploadUrl: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .use(withDB)
    .input(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.string(),
        fileSize: z.number().positive(),
      }),
    )
    .output(
      z.object({
        signedUrl: z.string(),
        path: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { fileName, mimeType, fileSize } = input;
      const { user } = ctx;

      validateMimeAndSize({
        mimeType,
        fileSize,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
        unsupportedMessage: UNSUPPORTED_MESSAGE,
      });

      const profileId = await getCurrentProfileId(user.id);
      const sanitized = sanitizeS3Filename(fileName);
      const path = `profile/${profileId}/posts/${randomUUID()}_${sanitized}`;

      return createSignedUploadUrl(path);
    }),

  uploadPostAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .use(withDB)
    .input(
      z.object({
        path: z.string(),
        fileName: z.string().min(1),
      }),
    )
    .output(
      z.object({
        url: z.string(),
        path: z.string(),
        id: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { path, fileName } = input;
      const { user } = ctx;

      const profileId = await getCurrentProfileId(user.id);
      validateStoragePath({
        path,
        expectedPrefix: `profile/${profileId}/posts/`,
      });

      try {
        const storageObject = await findUploadedStorageObject({
          path,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
          unsupportedMessage: UNSUPPORTED_MESSAGE,
        });

        const supabase = createStorageAdmin();
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, 60 * 60 * 24);

        if (signedUrlError || !signedUrlData) {
          console.error('createSignedUrl failed', {
            path,
            error: signedUrlError,
          });
          throw new CommonError('Could not get signed url');
        }

        return {
          url: signedUrlData.signedUrl,
          path,
          id: storageObject.id,
          fileName: sanitizeS3Filename(fileName),
          mimeType: storageObject.mimetype,
          fileSize: storageObject.size,
        };
      } catch (err) {
        scheduleStorageObjectCleanup(path);
        throw err;
      }
    }),
});
