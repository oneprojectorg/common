import { getRoles } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

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
  getRoles: commonAuthedProcedure()
    .output(outputSchema)
    .query(async () => {
      return await getRoles();
    }),
});
