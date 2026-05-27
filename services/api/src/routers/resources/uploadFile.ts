import {
  ALLOWED_RESOURCE_MIME_TYPES,
  assertResourceAccess,
  uploadResourceFile,
} from '@op/common';
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
      let profileId: string;
      if (target.kind === 'collection') {
        const resolved = await assertResourceAccess({
          scope: { kind: 'collection', collectionId: target.collectionId },
          authUserId: ctx.user.id,
          level: 'write',
        });
        profileId = resolved.profileId;
      } else {
        await assertResourceAccess({
          scope: { kind: 'profile', profileId: target.profileId },
          authUserId: ctx.user.id,
          level: 'write',
        });
        profileId = target.profileId;
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
