import { trackImageUpload } from '../../utils/analytics';
import { CommonError } from '@op/common';
import { eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { createServerClient } from '@op/supabase/lib';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import { Buffer } from 'buffer';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { MAX_FILE_SIZE, sanitizeS3Filename } from '../../utils';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const endpoint = 'uploadBannerImage';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Upload and update your banner image',
  },
};

export const uploadBannerImage = router({
  uploadBannerImage: loggedProcedure
    // middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .use(withDB)
    // Router
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
        id: z.string(),
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
      const filePath = `${ctx.user.id}/banner/${Date.now()}_${sanitizedFileName}`;

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

      // Update user's personal profile banner image
      if (data) {
        // Check if user has a profile and get their profile ID
        const [existingUser] = await db
          .select({
            profileId: users.profileId,
          })
          .from(users)
          .where(eq(users.authUserId, ctx.user.id));

        if (existingUser?.profileId) {
          // Check if profile had previous header image
          const [existingProfile] = await db
            .select({ headerImageId: profiles.headerImageId })
            .from(profiles)
            .where(eq(profiles.id, existingUser.profileId));

          const hadPreviousImage = existingProfile?.headerImageId;

          // Update personal profile banner
          await db
            .update(profiles)
            .set({
              headerImageId: data.id,
            })
            .where(eq(profiles.id, existingUser.profileId));

          // Track analytics (non-blocking)
          waitUntil(
            trackImageUpload(ctx, 'banner', !!hadPreviousImage),
          );
        } else {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User profile not found. Please create a profile first.',
          });
        }
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
        id: data!.id,
      };
    }),
});
