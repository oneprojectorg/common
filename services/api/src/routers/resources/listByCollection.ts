import { Channels, listResourcesByCollection } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceListEncoder } from './encoders';

export const listByCollection = router({
  listByCollection: commonAuthedProcedure()
    .input(z.object({ collectionId: z.string().uuid() }))
    .output(resourceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResourcesByCollection({
        authUserId: ctx.user.id,
        collectionId: input.collectionId,
      });
      ctx.registerQueryChannels([
        Channels.collectionResources(input.collectionId),
      ]);
      return resourceListEncoder.parse(result);
    }),
});
