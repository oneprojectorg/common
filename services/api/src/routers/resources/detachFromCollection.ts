import {
  Channels,
  detachResourceFromCollection,
  getProfileIdsForCollection,
  invalidateProfileResources,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const detachFromCollection = router({
  detachFromCollection: networkAuthenticatedProcedure()
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
      await invalidateProfileResources(profileIds);
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
    }),
});
