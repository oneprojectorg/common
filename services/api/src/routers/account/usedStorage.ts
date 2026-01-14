import { getUserStorageUsage } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const usedStorage = router({
  usedStorage: commonAuthedProcedure()
    .input(z.undefined())
    .output(
      z.object({
        usedStorage: z.number(),
        maxStorage: z.literal(4000000000),
      }),
    )
    .query(async ({ ctx }) => {
      return await getUserStorageUsage({ userId: ctx.user.id });
    }),
});

export default usedStorage;
