import {
  Channels,
  attachResourceToCollection,
  detachResourceFromCollection,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import { resourceInCollectionEncoder } from '../../encoders/resources';
import { commonAuthedProcedure, router } from '../../trpcFactory';

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
    .mutation(async ({ input, ctx }) => {
      const profileIds = await getProfileIdsForCollection(input.collectionId);
      await detachResourceFromCollection({
        authUserId: ctx.user.id,
        resourceId: input.id,
        collectionId: input.collectionId,
      });
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
    }),
});
