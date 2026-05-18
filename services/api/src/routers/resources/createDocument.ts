import {
  ALLOWED_RESOURCE_MIME_TYPES,
  MAX_RESOURCE_FILE_SIZE,
  createDocumentResource,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

const allowedMimeSchema = z.enum(
  ALLOWED_RESOURCE_MIME_TYPES as unknown as [string, ...string[]],
);

const inputSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(50),
    description: z.string().max(250).nullable().optional(),
    storageObjectId: z.string().uuid(),
    fileName: z.string().min(1).max(255),
    mimeType: allowedMimeSchema,
    fileSize: z.number().int().positive().max(MAX_RESOURCE_FILE_SIZE),
  })
  .refine(
    (v) => (v.profileId === undefined) !== (v.collectionId === undefined),
    { message: 'Exactly one of profileId / collectionId is required' },
  );

export const createDocument = router({
  createDocument: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 20 },
  })
    .use(withDB)
    .input(inputSchema)
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await createDocumentResource({
        authUserId: ctx.user.id,
        profileId: input.profileId,
        collectionId: input.collectionId,
        title: input.title,
        description: input.description ?? null,
        storageObjectId: input.storageObjectId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
      return resourceInCollectionEncoder.parse(row);
    }),
});
