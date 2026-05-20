import { getResource } from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceWithSignedUrlEncoder } from './encoders';

export const get = router({
  get: commonAuthedProcedure()
    .use(withDB)
    .input(z.object({ id: z.string().uuid() }))
    .output(resourceWithSignedUrlEncoder)
    .query(async ({ input, ctx }) => {
      const row = await getResource(ctx.user.id, input.id);
      return resourceWithSignedUrlEncoder.parse(row);
    }),
});
