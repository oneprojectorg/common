import { listResourcesByCollection } from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceListEncoder } from './encoders';

export const listByCollection = router({
  listByCollection: commonAuthedProcedure()
    .use(withDB)
    .input(z.object({ collectionId: z.string().uuid() }))
    .output(resourceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResourcesByCollection(
        ctx.user.id,
        input.collectionId,
      );
      return resourceListEncoder.parse(result);
    }),
});
