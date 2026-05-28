import { Channels, createCollection } from '@op/common';
import { z } from 'zod';

import { collectionEncoder } from '../../../encoders/resources';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const collectionsCreate = router({
  create: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .output(collectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await createCollection({
        authUserId: ctx.user.id,
        profileId: input.profileId,
        name: input.name,
      });
      ctx.registerMutationChannels([
        Channels.profileCollections(input.profileId),
      ]);
      return collectionEncoder.parse(row);
    }),
});
