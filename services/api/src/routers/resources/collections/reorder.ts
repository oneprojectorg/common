import { Channels, collectionSchema, reorderCollection } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  id: z.string().uuid(),
  upperNeighborId: z.string().uuid().nullable(),
});

export const collectionsReorder = router({
  reorder: commonNetworkProcedure()
    .input(inputSchema)
    .output(collectionSchema)
    .mutation(async ({ input, ctx }) => {
      const { collection, profileId } = await reorderCollection({
        authUserId: ctx.user.id,
        id: input.id,
        upperNeighborId: input.upperNeighborId,
      });
      ctx.registerMutationChannels([Channels.profileCollections(profileId)]);
      return collectionSchema.parse(collection);
    }),
});
