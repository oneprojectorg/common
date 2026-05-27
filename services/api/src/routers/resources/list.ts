import { Channels, listResources } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceListEncoder } from './encoders';

export const list = router({
  list: commonAuthedProcedure()
    .input(z.object({ profileId: z.string().uuid() }))
    .output(resourceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResources({
        authUserId: ctx.user.id,
        profileId: input.profileId,
      });
      ctx.registerQueryChannels([Channels.profileResources(input.profileId)]);
      return resourceListEncoder.parse(result);
    }),
});
