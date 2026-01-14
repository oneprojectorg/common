import { generateConnectionToken } from '@op/realtime/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const getToken = router({
  getToken: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 100 },
  })
    .input(z.undefined())
    .output(z.object({ token: z.string() }))
    .query(async ({ ctx }) => {
      const token = generateConnectionToken(ctx.user.id);

      return { token };
    }),
});
