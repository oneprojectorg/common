import {
  ALLOWED_RESOURCE_MIME_TYPES,
  Channels,
  MAX_RESOURCE_FILE_SIZE,
  createDocumentResource,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

const allowedMimeSchema = z.enum(ALLOWED_RESOURCE_MIME_TYPES);

// The upload flow already knows the profile (storage is profile-keyed) and
// optionally a target collection; pure-collection callers resolve the profile
// from collection access.
const inputSchema = z.object({
  target: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('profile'),
      profileId: z.string().uuid(),
      collectionId: z.string().uuid().optional(),
    }),
    z.object({
      kind: z.literal('collection'),
      collectionId: z.string().uuid(),
    }),
  ]),
  title: z.string().trim().min(1).max(50),
  description: z.string().max(250).nullable().optional(),
  storageObjectId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: allowedMimeSchema,
  fileSize: z.number().int().positive().max(MAX_RESOURCE_FILE_SIZE),
});

export const createDocument = router({
  createDocument: commonAuthedProcedure()
    .input(inputSchema)
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const { target } = input;
      const row = await createDocumentResource({
        authUserId: ctx.user.id,
        profileId: target.kind === 'profile' ? target.profileId : undefined,
        collectionId: target.collectionId,
        title: input.title,
        description: input.description ?? null,
        storageObjectId: input.storageObjectId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
      const profileIds =
        target.kind === 'profile'
          ? [target.profileId]
          : await getProfileIdsForCollection(row.collectionId);
      ctx.registerMutationChannels([
        Channels.collectionResources(row.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceInCollectionEncoder.parse(row);
    }),
});
