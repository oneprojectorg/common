import { Channels, RESOURCE_LIST_MAX_LIMIT, listCollections } from '@op/common';
import { z } from 'zod';

import { collectionListEncoder } from '../../../encoders/resources';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
  limit: z.number().int().positive().max(RESOURCE_LIST_MAX_LIMIT).optional(),
  cursor: z.string().nullish(),
});

export const collectionsList = router({
  list: commonAuthedProcedure()
    .input(inputSchema)
    .output(collectionListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listCollections({
        ...input,
        authUserId: ctx.user.id,
      });
      ctx.registerQueryChannels([Channels.profileCollections(input.profileId)]);
      return collectionListEncoder.parse(result);
    }),
});
