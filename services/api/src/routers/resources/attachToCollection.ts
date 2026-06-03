import {
  Channels,
  attachResourceToCollection,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import { resourceInCollectionEncoder } from '../../encoders/resources';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const attachToCollection = router({
  attachToCollection: networkAuthenticatedProcedure()
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
});
