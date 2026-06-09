import {
  Channels,
  RESOURCE_LIST_MAX_LIMIT,
  collectionListSchema,
  listCollections,
} from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
  limit: z.number().int().positive().max(RESOURCE_LIST_MAX_LIMIT).optional(),
  cursor: z.string().nullish(),
});

export const collectionsList = router({
  list: openProcedure()
    .input(inputSchema)
    .output(collectionListSchema)
    .query(async ({ input, ctx }) => {
      const result = await listCollections({
        ...input,
        user: ctx.user,
      });
      ctx.registerQueryChannels([Channels.profileCollections(input.profileId)]);
      return collectionListSchema.parse(result);
    }),
});
