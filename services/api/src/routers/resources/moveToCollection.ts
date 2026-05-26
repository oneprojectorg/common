import {
  Channels,
  attachResourceToCollection,
  detachResourceFromCollection,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

export const moveToCollection = router({
  attachToCollection: commonAuthedProcedure()
    .use(withDB)
    .input(
      z.object({
        id: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
    )
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await attachResourceToCollection(
        ctx.user.id,
        input.id,
        input.collectionId,
      );
      const profileIds = await getProfileIdsForCollection(input.collectionId);
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceInCollectionEncoder.parse(row);
    }),

  detachFromCollection: commonAuthedProcedure()
    .use(withDB)
    .input(
      z.object({
        id: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
    )
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      const profileIds = await getProfileIdsForCollection(input.collectionId);
      const result = await detachResourceFromCollection(
        ctx.user.id,
        input.id,
        input.collectionId,
      );
      ctx.registerMutationChannels([
        Channels.collectionResources(input.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return result;
    }),
});
