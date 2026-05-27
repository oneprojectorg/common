import {
  Channels,
  attachResourceToCollection,
  detachResourceFromCollection,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

export const moveToCollection = router({
  attachToCollection: commonAuthedProcedure()
    .input(
      z.object({
        id: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
    )
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await attachResourceToCollection({
        authUserId: ctx.user.id,
        resourceId: input.id,
        collectionId: input.collectionId,
      });
      const profileIds = await getProfileIdsForCollection(input.collectionId);
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceInCollectionEncoder.parse(row);
    }),

  detachFromCollection: commonAuthedProcedure()
    .input(
      z.object({
        id: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
    )
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      const profileIds = await getProfileIdsForCollection(input.collectionId);
      const result = await detachResourceFromCollection({
        authUserId: ctx.user.id,
        resourceId: input.id,
        collectionId: input.collectionId,
      });
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return result;
    }),
});
