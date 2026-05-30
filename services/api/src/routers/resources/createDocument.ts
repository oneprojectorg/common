import {
  ALLOWED_RESOURCE_MIME_TYPES,
  Channels,
  RESOURCE_DESCRIPTION_MAX_LEN,
  RESOURCE_TITLE_MAX_LEN,
  createDocumentResource,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import { resourceInCollectionEncoder } from '../../encoders/resources';
import { commonAuthedProcedure, router } from '../../trpcFactory';

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
  title: z.string().trim().min(1).max(RESOURCE_TITLE_MAX_LEN),
  description: z
    .string()
    .max(RESOURCE_DESCRIPTION_MAX_LEN)
    .nullable()
    .optional(),
  storagePath: z.string().min(1).max(1024),
  fileName: z.string().min(1).max(255),
  mimeType: allowedMimeSchema,
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
        storagePath: input.storagePath,
        fileName: input.fileName,
        mimeType: input.mimeType,
      });
      const profileIds =
        target.kind === 'profile'
          ? [target.profileId]
          : await getProfileIdsForCollection(row.collectionId);
      ctx.registerMutationChannels([
        Channels.collectionResources(row.collectionId),
        ...profileIds.flatMap((id) => [
          Channels.profileResources(id),
          // createDocument may lazy-create a default collection; broadcast so
          // the collections list subscriber refreshes without a manual invalidate.
          Channels.profileCollections(id),
        ]),
      ]);
      return resourceInCollectionEncoder.parse(row);
    }),
});
