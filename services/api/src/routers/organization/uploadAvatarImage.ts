import { CommonError } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { sanitizeS3Filename } from '../../utils';
import { trackImageUpload } from '../../utils/analytics';
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
];

export const uploadAvatarImage = router({
  createAvatarImageUploadUrl: commonAuthedProcedure()
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

      validateMimeAndSize({
        mimeType,
        fileSize,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });

      const sanitized = sanitizeS3Filename(fileName);
      const path = `${ctx.user.id}/orgAvatar/${randomUUID()}_${sanitized}`;

      return createSignedUploadUrl(path);
    }),

  uploadAvatarImage: commonAuthedProcedure()
    .input(
      z.object({
        path: z.string(),
      }),
    )
    .output(
      z.object({
        url: z.string(),
        path: z.string(),
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { path } = input;

      validateStoragePath({
        path,
        expectedPrefix: `${ctx.user.id}/orgAvatar/`,
      });

      try {
        const storageObject = await findUploadedStorageObject({
          path,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        });

        waitUntil(trackImageUpload(ctx, 'profile', false));

        const supabase = createStorageAdmin();
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, 60 * 60);

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
        };
      } catch (err) {
        scheduleStorageObjectCleanup(path);
        throw err;
      }
    }),

  createBannerImageUploadUrl: commonAuthedProcedure()
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

      validateMimeAndSize({
        mimeType,
        fileSize,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });

      const sanitized = sanitizeS3Filename(fileName);
      const path = `${ctx.user.id}/orgBanner/${randomUUID()}_${sanitized}`;

      return createSignedUploadUrl(path);
    }),

  uploadBannerImage: commonAuthedProcedure()
    .input(
      z.object({
        path: z.string(),
      }),
    )
    .output(
      z.object({
        url: z.string(),
        path: z.string(),
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { path } = input;

      validateStoragePath({
        path,
        expectedPrefix: `${ctx.user.id}/orgBanner/`,
      });

      try {
        const storageObject = await findUploadedStorageObject({
          path,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        });

        waitUntil(trackImageUpload(ctx, 'banner', false));

        const supabase = createStorageAdmin();
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, 60 * 60);

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
        };
      } catch (err) {
        scheduleStorageObjectCleanup(path);
        throw err;
      }
    }),
});
