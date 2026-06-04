import { getRoles } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

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
  getRoles: networkAuthenticatedProcedure()
    .output(outputSchema)
    .query(async () => {
      const result = await getRoles();
      return { roles: result.items };
    }),
});
