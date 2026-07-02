import {
  Channels,
  collectionSchema,
  invalidateProfileResources,
  reorderCollection,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  id: z.string().uuid(),
  upperNeighborId: z.string().uuid().nullable(),
});

export const collectionsReorder = router({
  reorder: networkAuthenticatedProcedure()
    .input(inputSchema)
    .output(collectionSchema)
    .mutation(async ({ input, ctx }) => {
      const { collection, profileId } = await reorderCollection({
        authUserId: ctx.user.id,
        id: input.id,
        upperNeighborId: input.upperNeighborId,
      });
      // Collection order drives the flattened resources.list order.
      await invalidateProfileResources([profileId]);
      ctx.registerMutationChannels([Channels.profileCollections(profileId)]);
      return collectionSchema.parse(collection);
    }),
});
