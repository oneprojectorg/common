import {
  CommonError,
  UnauthorizedError,
  getCurrentProfileId,
  getProfileAccessUser,
} from '@op/common';
import { db } from '@op/db/client';
import { createServerClient } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { sanitizeS3Filename } from '../../utils';

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

// Browser uploads the binary directly to storage via this signed URL,
// bypassing the tRPC handler's platform body-size cap.
export const createProposalAttachmentUploadUrl = router({
  createProposalAttachmentUploadUrl: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        fileName: z.string(),
        mimeType: z.string(),
        proposalId: z.string(),
      }),
    )
    .output(
      z.object({
        token: z.string(),
        path: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { fileName, mimeType, proposalId } = input;
      const { user } = ctx;

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new CommonError(
          'Unsupported file type. Allowed: PNG, JPEG, GIF, WebP, MP4, PDF, DOCX, XLSX.',
        );
      }

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

      const profileId = await getCurrentProfileId(user.id);
      const sanitizedFileName = sanitizeS3Filename(fileName);
      const path = `profile/${profileId}/proposals/${Date.now()}_${sanitizedFileName}`;

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

      const { data, error } = await supabase.storage
        .from('assets')
        .createSignedUploadUrl(path);

      if (error || !data) {
        throw new CommonError(error?.message ?? 'Failed to create upload URL');
      }

      return {
        token: data.token,
        path: data.path,
      };
    }),
});
