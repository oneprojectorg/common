import {
  ALLOWED_RESOURCE_MIME_TYPES,
  UnauthorizedError,
  assertProfileTypeAccess,
  getCurrentProfileId,
  uploadResourceFile,
} from '@op/common';
import { db } from '@op/db/client';
import { EntityType, resourceCollectionProfiles } from '@op/db/schema';
import { permission } from 'access-zones';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const allowedMimeSchema = z.enum(ALLOWED_RESOURCE_MIME_TYPES);

const inputSchema = z.object({
  target: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('profile'),
      profileId: z.string().uuid(),
    }),
    z.object({
      kind: z.literal('collection'),
      collectionId: z.string().uuid(),
    }),
  ]),
  file: z.string(),
  fileName: z.string().min(1).max(255),
  mimeType: allowedMimeSchema,
});

const outputSchema = z.object({
  profileId: z.string().uuid(),
  storageObjectId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  signedUrl: z.string().url(),
});

export const uploadFile = router({
  uploadFile: commonAuthedProcedure()
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { target } = input;
      const profileId =
        target.kind === 'profile'
          ? target.profileId
          : await getCurrentProfileId(ctx.user.id);

      await assertProfileTypeAccess({
        user: { id: ctx.user.id },
        profileIds: [profileId],
        policies: {
          [EntityType.DECISION]: { decisions: permission.ADMIN },
        },
      });

      if (target.kind === 'collection') {
        const [link] = await db
          .select({ id: resourceCollectionProfiles.id })
          .from(resourceCollectionProfiles)
          .where(
            and(
              eq(resourceCollectionProfiles.profileId, profileId),
              eq(resourceCollectionProfiles.collectionId, target.collectionId),
            ),
          )
          .limit(1);
        if (!link) {
          throw new UnauthorizedError("You don't have access to do this");
        }
      }

      const uploaded = await uploadResourceFile({
        profileId,
        base64File: input.file,
        fileName: input.fileName,
        mimeType: input.mimeType,
      });

      return {
        profileId,
        storageObjectId: uploaded.storageObjectId,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
        signedUrl: uploaded.signedUrl,
      };
    }),
});
