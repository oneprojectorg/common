import { generateConnectionToken } from '@op/realtime/server';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

export const getToken = router({
  getToken: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 100 }))
    .use(withAuthenticated)
    .input(z.undefined())
    .output(z.object({ token: z.string() }))
    .query(async ({ ctx }) => {
      const token = generateConnectionToken(ctx.user.id);

      return { token };
    }),
});
