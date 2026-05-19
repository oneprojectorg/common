import { CommonError } from '@op/common';
import { eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { waitUntil } from '@vercel/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
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

const UNSUPPORTED_MESSAGE =
  'Unsupported file type. Only images (PNG, JPEG, GIF, WebP) are allowed.';

// TODO: This is a duplicate of organization/uploadAvatarImage. Converge these
export const uploadAvatarImage = router({
  createImageUploadUrl: commonAuthedProcedure()
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
        unsupportedMessage: UNSUPPORTED_MESSAGE,
      });

      const sanitized = sanitizeS3Filename(fileName);
      const path = `${ctx.user.id}/avatar/${randomUUID()}_${sanitized}`;

      return createSignedUploadUrl(path);
    }),

  uploadImage: commonAuthedProcedure()
    .use(withDB)
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
      const { db } = ctx.database;

      validateStoragePath({
        path,
        expectedPrefix: `${ctx.user.id}/avatar/`,
      });

      try {
        const storageObject = await findUploadedStorageObject({
          path,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
          unsupportedMessage: UNSUPPORTED_MESSAGE,
        });

        const [existingUser] = await db
          .select({
            avatarImageId: users.avatarImageId,
            profileId: users.profileId,
          })
          .from(users)
          .where(eq(users.authUserId, ctx.user.id));

        const hadPreviousImage = existingUser?.avatarImageId;

        await db
          .update(users)
          .set({ avatarImageId: storageObject.id })
          .where(eq(users.authUserId, ctx.user.id));

        if (existingUser?.profileId) {
          await db
            .update(profiles)
            .set({ avatarImageId: storageObject.id })
            .where(eq(profiles.id, existingUser.profileId));
        }

        waitUntil(trackImageUpload(ctx, 'profile', !!hadPreviousImage));

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
