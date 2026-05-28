import {
  Channels,
  getProfileIdsForCollection,
  updateCollection,
} from '@op/common';
import { z } from 'zod';

import { collectionEncoder } from '../../../encoders/resources';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const dataSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const collectionsUpdate = router({
  update: commonAuthedProcedure()
    .input(z.object({ id: z.string().uuid(), data: dataSchema }))
    .output(collectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await updateCollection({
        authUserId: ctx.user.id,
        id: input.id,
        data: input.data,
      });
      const profileIds = await getProfileIdsForCollection(input.id);
      ctx.registerMutationChannels(
        profileIds.map((id) => Channels.profileCollections(id)),
      );
      return collectionEncoder.parse(row);
    }),
});
