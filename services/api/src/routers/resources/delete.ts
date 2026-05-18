import { deleteResource } from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deleteResourceRouter = router({
  delete: commonAuthedProcedure()
    .use(withDB)
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      return deleteResource(ctx.user.id, input.id);
    }),
});
