import { getRoles } from '@op/common';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../trpcFactory';

const outputSchema = z.object({
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
});

export const getRolesRouter = router({
  getRoles: loggedProcedure
    .use(withAuthenticated)
    .output(outputSchema)
    .query(async () => {
      return await getRoles();
    }),
});