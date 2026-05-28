import {
  Channels,
  getProfileIdsForCollection,
  reorderCollection,
} from '@op/common';
import { z } from 'zod';

import { collectionEncoder } from '../../../encoders/resources';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  id: z.string().uuid(),
  upperNeighborId: z.string().uuid().nullable(),
});

export const collectionsReorder = router({
  reorder: commonAuthedProcedure()
    .input(inputSchema)
    .output(collectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await reorderCollection({
        authUserId: ctx.user.id,
        id: input.id,
        upperNeighborId: input.upperNeighborId,
      });
      const profileIds = await getProfileIdsForCollection(input.id);
      ctx.registerMutationChannels(
        profileIds.map((id) => Channels.profileCollections(id)),
      );
      return collectionEncoder.parse(row);
    }),
});
