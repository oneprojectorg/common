import { createServerClient } from '@op/supabase/lib';
import { TRPCError } from '@trpc/server';
import { Buffer } from 'buffer';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { sanitizeS3Filename } from '../../utils';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const endpoint = 'uploadPostAttachment';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: `/organization/${endpoint}/attachment`,
    protect: true,
    tags: ['organization'],
    summary: 'Upload a attachment for posts',
  },
};

export const uploadPostAttachment = router({
  uploadPostAttachment: loggedProcedure
    // middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
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
        id: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { file, fileName, mimeType } = input;
      // @ts-ignore
      const { logger } = ctx;

      const sanitizedFileName = sanitizeS3Filename(fileName);

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Unsupported file type. Only images (PNG, JPEG, WebP) and PDFs are allowed.',
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
        logger?.info('Error decoding base64', _err);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid base64 encoding',
        });
      }

      // Check file size
      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
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
      const filePath = `posts/${ctx.user.id}/${Date.now()}_${sanitizedFileName}`;

      logger?.info('UPLOADING POST ATTACHMENT: ' + filePath);

      const { error: uploadError, data } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        logger?.info('UPLOAD ERROR', uploadError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: uploadError.message,
        });
      }

      if (!data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Upload failed - no data returned',
        });
      }

      // Get signed URL
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours

      if (signedUrlError || !signedUrlData) {
        logger?.info('SIGNED URL ERROR', signedUrlError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: signedUrlError?.message || 'Could not get signed url',
        });
      }

      logger?.info(
        'RETURNING UPLOAD URL: ' + signedUrlData.signedUrl + ' - ' + filePath,
      );

      return {
        url: signedUrlData.signedUrl,
        path: filePath,
        id: data.id,
        fileName: sanitizedFileName,
        mimeType,
        fileSize: buffer.length,
      };
    }),
});
