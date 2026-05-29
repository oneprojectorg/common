import { Channels, deleteCollection } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const collectionChannels = (profileIds: string[]) => [
  ...profileIds.map((id) => Channels.profileCollections(id)),
  ...profileIds.map((id) => Channels.profileResources(id)),
];

export const collectionsDelete = router({
  delete: commonAuthedProcedure()
    .input(z.object({ collectionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { profileIds } = await deleteCollection({
        authUserId: ctx.user.id,
        id: input.collectionId,
      });
      ctx.registerMutationChannels(collectionChannels(profileIds));
    }),
});
