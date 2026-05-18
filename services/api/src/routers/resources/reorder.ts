import { reorderResource } from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

const inputSchema = z
  .object({
    id: z.string().uuid(),
    collectionId: z.string().uuid(),
    beforeId: z.string().uuid().optional(),
    afterId: z.string().uuid().optional(),
  })
  .refine((v) => (v.beforeId === undefined) !== (v.afterId === undefined), {
    message: 'Exactly one of beforeId / afterId is required',
  });

export const reorder = router({
  reorder: commonAuthedProcedure()
    .use(withDB)
    .input(inputSchema)
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await reorderResource(
        ctx.user.id,
        input.id,
        input.collectionId,
        input.beforeId,
        input.afterId,
      );
      return resourceInCollectionEncoder.parse(row);
    }),
});
