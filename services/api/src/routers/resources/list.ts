import { listResources } from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceListEncoder } from './encoders';

export const list = router({
  list: commonAuthedProcedure()
    .use(withDB)
    .input(z.object({ profileId: z.string().uuid() }))
    .output(resourceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResources(ctx.user.id, input.profileId);
      return resourceListEncoder.parse(result);
    }),
});
