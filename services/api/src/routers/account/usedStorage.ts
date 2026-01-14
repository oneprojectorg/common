import { getUserStorageUsage } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const endpoint = 'usedStorage';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Get total used storage for the user',
  },
};

const usedStorage = router({
  usedStorage: commonAuthedProcedure
    .meta(meta)
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
