import {
  Channels,
  CommonError,
  NotFoundError,
  ValidationError,
  assertProfileAccess,
  invalidateDecisionInstance,
  updateDecisionInstance,
} from '@op/common';
import { createServerClient } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { Buffer } from 'buffer';
import { z } from 'zod';

import withDB from '../../../middlewares/withDB';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';
import { MAX_FILE_SIZE, sanitizeS3Filename } from '../../../utils';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

/**
 * Uploads a hero background image for a decision overview. Admin-only: the
 * caller must have decisions ADMIN on the instance's profile. The image bytes
 * land in the `assets` bucket and the resulting storage path is persisted into
 * `instanceData.overview.backgroundImage` (cleared by sending an empty string
 * to updateDecisionInstance instead).
 */
export const uploadOverviewBackgroundImageRouter = router({
  uploadOverviewBackgroundImage: authenticatedConfirmedProcedure()
    .use(withDB)
    .input(
      z.object({
        instanceId: z.string(),
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
      const { instanceId, file, fileName, mimeType } = input;
      const { user } = ctx;
      const { db } = ctx.database;

      // Assert admin BEFORE touching storage so non-admins can't push orphan
      // files into the bucket.
      const instance = await db.query.processInstances.findFirst({
        where: { id: instanceId },
        columns: { profileId: true },
      });
      if (!instance?.profileId) {
        throw new NotFoundError('Process instance', instanceId);
      }
      await assertProfileAccess({
        user,
        profileId: instance.profileId,
        permissions: { decisions: permission.ADMIN },
      });

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
        throw new ValidationError('Invalid base64 encoding');
      }

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
      const filePath = `${instanceId}/overview/${Date.now()}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });
      if (uploadError) {
        throw new CommonError(uploadError.message);
      }

      // Persist the path on the overview (re-asserts admin internally).
      await updateDecisionInstance({
        instanceId,
        overview: { backgroundImage: filePath },
        user,
      });
      await invalidateDecisionInstance(instanceId);
      ctx.registerMutationChannels([Channels.decisionInstance(instanceId)]);

      // Signed URL for an immediate optimistic preview; the persisted path is
      // read back through getPublicUrl on subsequent loads.
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60);
      if (signedUrlError || !signedUrlData) {
        throw new CommonError(
          signedUrlError?.message || 'Could not get signed url',
        );
      }

      return {
        url: signedUrlData.signedUrl,
        path: filePath,
      };
    }),
});
