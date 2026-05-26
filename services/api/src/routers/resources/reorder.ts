import {
  Channels,
  getProfileIdsForCollection,
  reorderResource,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

const inputSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid(),
  upperNeighborId: z.string().uuid().nullable(),
});

export const reorder = router({
  reorder: commonAuthedProcedure()
    .use(withDB)
    .input(inputSchema)
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await reorderResource(
        ctx.user.id,
        input.id,
        input.collectionId,
        input.upperNeighborId,
      );
      const profileIds = await getProfileIdsForCollection(input.collectionId);
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceInCollectionEncoder.parse(row);
    }),
});
