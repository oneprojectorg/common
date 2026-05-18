import {
  CommonError,
  UnauthorizedError,
  getCurrentProfileId,
  getProfileAccessUser,
  uploadProposalAttachment as uploadProposalAttachmentService,
} from '@op/common';
import { db } from '@op/db/client';
import { createServerClient } from '@op/supabase/lib';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { MAX_FILE_SIZE, sanitizeS3Filename } from '../../utils';

const BUCKET = 'assets';

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

function createStorageAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new CommonError('Storage configuration missing');
  }

  return createServerClient(supabaseUrl, supabaseServiceRole, {
    cookieOptions: {},
    cookies: {
      getAll: async () => [],
      setAll: async () => {},
    },
  });
}

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

function validateMimeAndSize(mimeType: string, fileSize: number) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new CommonError(
      'Unsupported file type. Allowed: PNG, JPEG, GIF, WebP, MP4, PDF, DOCX, XLSX.',
    );
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw new CommonError(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    );
  }
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
        token: z.string(),
        path: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { proposalId, fileName, mimeType, fileSize } = input;
      const { user } = ctx;

      validateMimeAndSize(mimeType, fileSize);
      await assertCanUpdateProposalAttachments(user, proposalId);

      const profileId = await getCurrentProfileId(user.id);
      const sanitized = sanitizeS3Filename(fileName);
      const path = `profile/${profileId}/proposals/${proposalId}/${randomUUID()}_${sanitized}`;

      const supabase = createStorageAdmin();
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data) {
        throw new CommonError(error?.message ?? 'Failed to create upload URL');
      }

      return {
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
      };
    }),

  uploadProposalAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.string(),
        path: z.string(),
        fileName: z.string().min(1),
        mimeType: z.string(),
        fileSize: z.number().positive(),
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
      const { proposalId, path, fileName, mimeType, fileSize } = input;
      const { user } = ctx;

      validateMimeAndSize(mimeType, fileSize);
      await assertCanUpdateProposalAttachments(user, proposalId);

      const profileId = await getCurrentProfileId(user.id);
      const expectedPrefix = `profile/${profileId}/proposals/${proposalId}/`;

      if (!path.startsWith(expectedPrefix) || path.includes('..')) {
        throw new UnauthorizedError('Invalid attachment path');
      }

      const storageObject = await db.query.objectsInStorage.findFirst({
        where: { bucketId: BUCKET, name: path },
      });

      if (!storageObject) {
        throw new CommonError('Uploaded file not found in storage');
      }

      const result = await uploadProposalAttachmentService({
        input: {
          fileName: sanitizeS3Filename(fileName),
          mimeType,
          fileSize,
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
    }),
});
