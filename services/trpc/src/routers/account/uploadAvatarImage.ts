import { Buffer } from 'buffer';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { eq } from '@op/db/client';
import { users } from '@op/db/schema';
import { createServerClient } from '@op/supabase/lib';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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

export const uploadAvatarImage = router({
  uploadImage: loggedProcedure
    // middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { file, fileName, mimeType } = input;
      const { db } = ctx.database;

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unsupported file type',
        });
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
      const filePath = `${ctx.user.id}/${Date.now()}_${fileName}`;

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
        await db
          .update(users)
          .set({
            avatarImageId: data.id,
          })
          .where(eq(users.authUserId, ctx.user.id));
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
