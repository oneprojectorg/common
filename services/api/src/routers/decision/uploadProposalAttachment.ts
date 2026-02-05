import {
  CommonError,
  getCurrentProfileId,
  uploadProposalAttachment as uploadProposalAttachmentService,
} from '@op/common';
import { createServerClient } from '@op/supabase/lib';
import { Buffer } from 'node:buffer';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { MAX_FILE_SIZE, sanitizeS3Filename } from '../../utils';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const uploadProposalAttachment = router({
  uploadProposalAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        file: z.string(), // base64 encoded
        fileName: z.string(),
        mimeType: z.string(),
        proposalId: z.string(),
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
      const { file, fileName, mimeType, proposalId } = input;
      const { user } = ctx;
      const profileId = await getCurrentProfileId(user.id);

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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

      if (!supabaseUrl || !supabaseServiceRole) {
        throw new CommonError('Storage configuration missing');
      }

      const supabase = createServerClient(supabaseUrl, supabaseServiceRole, {
        cookieOptions: {},
        cookies: {
          getAll: async () => [],
          setAll: async () => {},
        },
      });

      const bucket = 'assets';
      const filePath = `profile/${profileId}/proposals/${Date.now()}_${sanitizedFileName}`;

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

      // Create attachment record and optionally link to proposal
      const result = await uploadProposalAttachmentService({
        input: {
          fileName: sanitizedFileName,
          mimeType,
          fileSize: buffer.length,
          storageObjectId: data.id,
          proposalId,
        },
        user,
      });

      return {
        url: signedUrlData.signedUrl,
        path: filePath,
        id: result.id,
        fileName: result.fileName,
        mimeType: result.mimeType,
        fileSize: result.fileSize,
      };
    }),
});
