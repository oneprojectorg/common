import {
  Channels,
  detachResourceFromCollection,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../trpcFactory';

export const detachFromCollection = router({
  detachFromCollection: commonNetworkProcedure()
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
