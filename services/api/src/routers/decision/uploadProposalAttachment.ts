import {
  CommonError,
  UnauthorizedError,
  getCurrentProfileId,
  getProfileAccessUser,
  uploadProposalAttachment as uploadProposalAttachmentService,
} from '@op/common';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { sanitizeS3Filename } from '../../utils';
import {
  createSignedUploadUrl,
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
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4',
];

const UNSUPPORTED_MESSAGE =
  'Unsupported file type. Allowed: PNG, JPEG, GIF, WebP, MP4, PDF, DOCX, XLSX.';

async function assertCanUpdateProposalAttachments(
  user: User,
  proposalId: string,
) {
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  const profileUser = await getProfileAccessUser({
    user: { id: user.id },
    profileId: proposal.profileId,
  });

  if (!profileUser) {
    throw new UnauthorizedError('Not authorized');
  }

  assertAccess({ profile: permission.UPDATE }, profileUser.roles);
}

export const uploadProposalAttachment = router({
  createProposalAttachmentUploadUrl: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.string(),
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
      const { proposalId, fileName, mimeType, fileSize } = input;
      const { user } = ctx;

      validateMimeAndSize({
        mimeType,
        fileSize,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
        unsupportedMessage: UNSUPPORTED_MESSAGE,
      });
      await assertCanUpdateProposalAttachments(user, proposalId);

      const profileId = await getCurrentProfileId(user.id);
      const sanitized = sanitizeS3Filename(fileName);
      const path = `profile/${profileId}/proposals/${proposalId}/${randomUUID()}_${sanitized}`;

      return createSignedUploadUrl(path);
    }),

  uploadProposalAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.string(),
        path: z.string(),
        fileName: z.string().min(1),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { proposalId, path, fileName } = input;
      const { user } = ctx;

      await assertCanUpdateProposalAttachments(user, proposalId);

      const profileId = await getCurrentProfileId(user.id);
      validateStoragePath({
        path,
        expectedPrefix: `profile/${profileId}/proposals/${proposalId}/`,
      });

      try {
        const storageObject = await findUploadedStorageObject({
          path,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
          unsupportedMessage: UNSUPPORTED_MESSAGE,
        });

        const result = await uploadProposalAttachmentService({
          input: {
            fileName: sanitizeS3Filename(fileName),
            mimeType: storageObject.mimetype,
            fileSize: storageObject.size,
            storageObjectId: storageObject.id,
            proposalId,
          },
          user,
        });

        return {
          id: result.id,
          fileName: result.fileName,
          mimeType: result.mimeType,
          fileSize: result.fileSize,
        };
      } catch (err) {
        scheduleStorageObjectCleanup(path);
        throw err;
      }
    }),
});
