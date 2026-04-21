import { CommonError, ValidationError } from '@op/common';
import { createServerClient } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { Buffer } from 'buffer';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { MAX_FILE_SIZE, sanitizeS3Filename } from '../../utils';
import { trackImageUpload } from '../../utils/analytics';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export const uploadAvatarImage = router({
  uploadAvatarImage: commonAuthedProcedure()
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
      // @ts-ignore
      const { logger } = ctx;

      const sanitizedFileName = sanitizeS3Filename(fileName);
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new ValidationError('Unsupported file type');
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
        throw new ValidationError('Invalid base64 encoding');
      }

      // Check file size
      if (buffer.length > MAX_FILE_SIZE) {
        throw new ValidationError(
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
      const filePath = `${ctx.user.id}/temp/${Date.now()}_${sanitizedFileName}`;

      logger.info('UPLOADING FILE' + filePath);

      const { error: uploadError, data } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new CommonError(uploadError.message);
      }

      // Get signed URL
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60); // 1 hour

      logger.info('GOT SIGNED URL' + signedUrlData);

      if (signedUrlError || !signedUrlData) {
        throw new CommonError(
          signedUrlError?.message || 'Could not get signed url',
        );
      }

      logger.info(
        'RETURNING UPLOAD URL' + signedUrlData.signedUrl + ' - ' + filePath,
      );

      // Track analytics - for organization uploads, we'll track as new uploads since they're temporary (non-blocking)
      const imageType = filePath.includes('banner') ? 'banner' : 'profile';
      waitUntil(trackImageUpload(ctx, imageType, false));

      return {
        url: signedUrlData.signedUrl,
        path: filePath,
        id: data.id,
      };
    }),
});
