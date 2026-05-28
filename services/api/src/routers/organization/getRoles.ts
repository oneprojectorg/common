import { getRoles } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../trpcFactory';

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
  getRoles: commonNetworkProcedure()
    .output(outputSchema)
    .query(async () => {
      const result = await getRoles();
      return { roles: result.items };
    }),
});
