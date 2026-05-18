import {
  attachResourceToCollection,
  detachResourceFromCollection,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

export const moveToCollection = router({
  attachToCollection: commonAuthedProcedure()
    .use(withDB)
    .input(
      z.object({
        id: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
    )
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await attachResourceToCollection(
        ctx.user.id,
        input.id,
        input.collectionId,
      );
      return resourceInCollectionEncoder.parse(row);
    }),

  detachFromCollection: commonAuthedProcedure()
    .use(withDB)
    .input(
      z.object({
        id: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
    )
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      return detachResourceFromCollection(
        ctx.user.id,
        input.id,
        input.collectionId,
      );
    }),
});
