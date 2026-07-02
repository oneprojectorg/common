import {
  Channels,
  deleteCollection,
  invalidateProfileResources,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const collectionChannels = (profileIds: string[]) => [
  ...profileIds.map((id) => Channels.profileCollections(id)),
  ...profileIds.map((id) => Channels.profileResources(id)),
];

export const collectionsDelete = router({
  delete: networkAuthenticatedProcedure()
    .input(z.object({ collectionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { profileIds } = await deleteCollection({
        authUserId: ctx.user.id,
        id: input.collectionId,
      });
      await invalidateProfileResources(profileIds);
      ctx.registerMutationChannels(collectionChannels(profileIds));
    }),
});
