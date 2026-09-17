import { getCollabToken } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const getCollabTokenRouter = router({
  getCollabToken: authenticatedProcedure()
    .input(z.object({ proposalProfileId: z.uuid() }))
    .output(z.object({ token: z.string() }))
    .query(({ ctx, input }) => getCollabToken({ ...input, user: ctx.user })),
});
