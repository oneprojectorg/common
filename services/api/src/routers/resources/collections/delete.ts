import {
  Channels,
  deleteCollection,
  getProfileIdsForCollection,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const collectionChannels = (profileIds: string[], collectionId: string) => [
  ...profileIds.map((id) => Channels.profileCollections(id)),
  ...profileIds.map((id) => Channels.profileResources(id)),
  Channels.collectionResources(collectionId),
];

export const collectionsDelete = router({
  delete: commonAuthedProcedure()
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const profileIds = await getProfileIdsForCollection(input.id);
      await deleteCollection({
        authUserId: ctx.user.id,
        id: input.id,
      });
      ctx.registerMutationChannels(collectionChannels(profileIds, input.id));
    }),
});
