import { Channels, collectionSchema, updateCollection } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

const dataSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const collectionsUpdate = router({
  update: commonNetworkProcedure()
    .input(z.object({ id: z.string().uuid(), data: dataSchema }))
    .output(collectionSchema)
    .mutation(async ({ input, ctx }) => {
      const { collection, profileId } = await updateCollection({
        authUserId: ctx.user.id,
        id: input.id,
        data: input.data,
      });
      ctx.registerMutationChannels([Channels.profileCollections(profileId)]);
      return collectionSchema.parse(collection);
    }),
});
