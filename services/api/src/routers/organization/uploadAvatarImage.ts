import { CommonError } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { sanitizeS3Filename } from '../../utils';
import { trackImageUpload } from '../../utils/analytics';
import {
  STORAGE_BUCKET,
  createSignedUploadUrl,
  createStorageAdmin,
  getUploadedStorageObject,
  scheduleStorageObjectCleanup,
  validateMimeAndSize,
  assertValidStoragePath,
} from '../../utils/storage';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export const uploadAvatarImage = router({
  createAvatarImageUploadUrl: networkAuthenticatedProcedure()
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

  uploadAvatarImage: networkAuthenticatedProcedure()
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

      assertValidStoragePath({
        path,
        expectedPrefix: `${ctx.user.id}/orgAvatar/`,
      });

      try {
        const storageObject = await getUploadedStorageObject({
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

  createBannerImageUploadUrl: networkAuthenticatedProcedure()
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

  uploadBannerImage: networkAuthenticatedProcedure()
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

      assertValidStoragePath({
        path,
        expectedPrefix: `${ctx.user.id}/orgBanner/`,
      });

      try {
        const storageObject = await getUploadedStorageObject({
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
