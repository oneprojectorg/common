import {
  Channels,
  RESOURCE_LIST_MAX_LIMIT,
  listResourcesByCollection,
} from '@op/common';
import { z } from 'zod';

import { resourceListEncoder } from '../../encoders/resources';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  collectionId: z.string().uuid(),
  limit: z.number().int().positive().max(RESOURCE_LIST_MAX_LIMIT).optional(),
  cursor: z.string().nullish(),
});

export const listByCollection = router({
  listByCollection: networkAuthenticatedProcedure()
    .input(inputSchema)
    .output(resourceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResourcesByCollection({
        ...input,
        authUserId: ctx.user.id,
      });
      ctx.registerQueryChannels([
        Channels.collectionResources(input.collectionId),
      ]);
      return resourceListEncoder.parse(result);
    }),
});
