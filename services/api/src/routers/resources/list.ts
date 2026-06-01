import { Channels, RESOURCE_LIST_MAX_LIMIT, listResources } from '@op/common';
import { z } from 'zod';

import { resourceListEncoder } from '../../encoders/resources';
import { commonNetworkProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
  limit: z.number().int().positive().max(RESOURCE_LIST_MAX_LIMIT).optional(),
  cursor: z.string().nullish(),
});

export const list = router({
  list: commonNetworkProcedure()
    .input(inputSchema)
    .output(resourceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResources({
        ...input,
        authUserId: ctx.user.id,
      });
      ctx.registerQueryChannels([Channels.profileResources(input.profileId)]);
      return resourceListEncoder.parse(result);
    }),
});
