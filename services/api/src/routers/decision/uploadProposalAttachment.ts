import { CommonError, getCurrentProfileId } from '@op/common';
import { and, db, eq } from '@op/db/client';
import { attachments, proposalAttachments } from '@op/db/schema';
import { createServerClient } from '@op/supabase/lib';
import { Buffer } from 'buffer';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { MAX_FILE_SIZE, sanitizeS3Filename } from '../../utils';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export const uploadProposalAttachment = router({
  uploadProposalAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .use(withDB)
    .input(
      z.object({
        file: z.string(), // base64 encoded
        fileName: z.string(),
        mimeType: z.string(),
        // Optional - if provided, links attachment to proposal immediately on upload
        // Use for proposal attachments; omit for inline images in rich text content
        proposalId: z.string().optional(),
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

      // Create attachment record in database
      const [attachment] = await db
        .insert(attachments)
        .values({
          storageObjectId: data.id,
          fileName: sanitizedFileName,
          mimeType,
          fileSize: buffer.length,
          profileId,
          // postId is optional - we don't set it for proposal attachments
        })
        .returning();

      if (!attachment) {
        throw new CommonError('Failed to create attachment record');
      }

      // Link attachment to proposal immediately for better UX (if proposalId provided)
      if (proposalId) {
        await db.insert(proposalAttachments).values({
          proposalId,
          attachmentId: attachment.id,
          uploadedBy: profileId,
        });
      }

      return {
        url: signedUrlData.signedUrl,
        path: filePath,
        id: attachment.id,
        fileName: sanitizedFileName,
        mimeType,
        fileSize: buffer.length,
      };
    }),

  deleteProposalAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .use(withDB)
    .input(
      z.object({
        attachmentId: z.string(),
        proposalId: z.string(),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { attachmentId, proposalId } = input;
      const { user } = ctx;
      const profileId = await getCurrentProfileId(user.id);

      // Verify the attachment link exists and user has permission (they uploaded it)
      const existingLink = await db
        .select()
        .from(proposalAttachments)
        .where(
          and(
            eq(proposalAttachments.proposalId, proposalId),
            eq(proposalAttachments.attachmentId, attachmentId),
          ),
        )
        .limit(1);

      if (!existingLink[0]) {
        throw new CommonError('Attachment not found on this proposal');
      }

      // Only the uploader can delete
      if (existingLink[0].uploadedBy !== profileId) {
        throw new CommonError('Not authorized to delete this attachment');
      }

      // Delete the link (soft delete - keeps the attachment record)
      await db
        .delete(proposalAttachments)
        .where(
          and(
            eq(proposalAttachments.proposalId, proposalId),
            eq(proposalAttachments.attachmentId, attachmentId),
          ),
        );

      return { success: true };
    }),
});
