import { CommonError, getSession } from '@op/common';
import { createServerClient } from '@op/supabase/lib';
import { Buffer } from 'buffer';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

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
  'application/pdf',
];

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: `/posts/attachment`,
    protect: true,
    tags: ['profile'],
    summary: 'Upload a attachment',
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
    .mutation(async ({ input }) => {
      const { file, fileName, mimeType } = input;
      const session = await getSession();
      const profileId = session?.user.currentProfileId;

      const sanitizedFileName = sanitizeS3Filename(fileName);

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new CommonError(
          'Unsupported file type. Only images (PNG, JPEG, GIF, WebP) and PDFs are allowed.',
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
        throw new CommonError('Invalid base64 encoding');
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
      const filePath = `profile/${profileId}/posts/${Date.now()}_${sanitizedFileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new CommonError(uploadError.message);
      }

      if (!data) {
        throw new CommonError('Upload failed - no data returned');
      }

      // Get signed URL
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours

      if (signedUrlError || !signedUrlData) {
        throw new CommonError('Could not get signed url');
      }

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
