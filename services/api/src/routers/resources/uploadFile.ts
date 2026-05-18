import {
  ALLOWED_RESOURCE_MIME_TYPES,
  assertResourceAccess,
  uploadResourceFile,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const allowedMimeSchema = z.enum(
  ALLOWED_RESOURCE_MIME_TYPES as unknown as [string, ...string[]],
);

const inputSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    file: z.string(),
    fileName: z.string().min(1).max(255),
    mimeType: allowedMimeSchema,
  })
  .refine(
    (v) => (v.profileId === undefined) !== (v.collectionId === undefined),
    { message: 'Exactly one of profileId / collectionId is required' },
  );

const outputSchema = z.object({
  storageObjectId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  signedUrl: z.string().url(),
});

export const uploadFile = router({
  uploadFile: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 20 },
  })
    .use(withDB)
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      let profileId: string;
      if (input.collectionId) {
        const resolved = await assertResourceAccess(
          { kind: 'collection', collectionId: input.collectionId },
          ctx.user.id,
          'write',
        );
        profileId = resolved.profileId;
      } else {
        await assertResourceAccess(
          { kind: 'profile', profileId: input.profileId as string },
          ctx.user.id,
          'write',
        );
        profileId = input.profileId as string;
      }

      const uploaded = await uploadResourceFile({
        profileId,
        base64File: input.file,
        fileName: input.fileName,
        mimeType: input.mimeType,
      });

      return {
        storageObjectId: uploaded.storageObjectId,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
        signedUrl: uploaded.signedUrl,
      };
    }),
});
