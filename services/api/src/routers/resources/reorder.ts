import {
  Channels,
  getProfileIdsForCollection,
  reorderResource,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

const inputSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid(),
  upperNeighborId: z.string().uuid().nullable(),
});

export const reorder = router({
  reorder: commonAuthedProcedure()
    .input(inputSchema)
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await reorderResource({
        authUserId: ctx.user.id,
        resourceId: input.id,
        collectionId: input.collectionId,
        upperNeighborId: input.upperNeighborId,
      });
      const profileIds = await getProfileIdsForCollection(input.collectionId);
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceInCollectionEncoder.parse(row);
    }),
});
