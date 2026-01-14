import { CommonError } from '@op/common';
import { eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { createServerClient } from '@op/supabase/lib';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import { Buffer } from 'buffer';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { MAX_FILE_SIZE, sanitizeS3Filename } from '../../utils';
import { trackImageUpload } from '../../utils/analytics';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const endpoint = 'uploadAvatarImage';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Upload and update your avatar image',
  },
};

// TODO: This is a duplicate of organization/uploadAvatarImage. Converge these
export const uploadAvatarImage = router({
  uploadImage: commonAuthedProcedure()
    .use(withDB)
    .meta(meta)
    .input(
      z.object({
        file: z.string(), // base64 encoded
        fileName: z.string(),
        mimeType: z.string(),
      }),
    )
    .output(
      z.object({
        url: z.string(),
        path: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { file, fileName, mimeType } = input;
      const { db } = ctx.database;

      const sanitizedFileName = sanitizeS3Filename(fileName);
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new CommonError(
          'Unsupported file type. Only images (PNG, JPEG, GIF, WebP) are allowed.',
        );
      }

      let buffer: Buffer;

      try {
        // Accept data URLs or plain base64
        let base64 = file;

        if (file.startsWith('data:')) {
          const commaIndex = file.indexOf(',');

          if (commaIndex === -1) {
            throw new Error('Invalid data URL');
          }

          base64 = file.slice(commaIndex + 1);
        }

        buffer = Buffer.from(base64, 'base64');
      } catch (_err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid base64 encoding',
        });
      }

      // Check file size
      if (buffer.length > MAX_FILE_SIZE) {
        throw new CommonError(
          `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE!,
        {
          cookieOptions: {},
          cookies: {
            getAll: async () => [],
            setAll: async () => {},
          },
        },
      );
      const bucket = 'assets';
      const filePath = `${ctx.user.id}/${Date.now()}_${sanitizedFileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: uploadError.message,
        });
      }

      // assign the avatar image
      if (data) {
        // Check if user had previous avatar and get their profile ID
        const [existingUser] = await db
          .select({
            avatarImageId: users.avatarImageId,
            profileId: users.profileId,
          })
          .from(users)
          .where(eq(users.authUserId, ctx.user.id));

        const hadPreviousImage = existingUser?.avatarImageId;

        // Update user avatar
        await db
          .update(users)
          .set({
            avatarImageId: data.id,
          })
          .where(eq(users.authUserId, ctx.user.id));

        // Update personal profile avatar if user has a profile
        if (existingUser?.profileId) {
          await db
            .update(profiles)
            .set({
              avatarImageId: data.id,
            })
            .where(eq(profiles.id, existingUser.profileId));
        }

        // Track analytics (non-blocking)
        waitUntil(trackImageUpload(ctx, 'profile', !!hadPreviousImage));
      }

      // Get signed URL
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60); // 1 hour

      if (signedUrlError || !signedUrlData) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: signedUrlError?.message || 'Could not get signed url',
        });
      }

      return {
        url: signedUrlData.signedUrl,
        path: filePath,
      };
    }),
});
