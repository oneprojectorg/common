import { getRoles } from '@op/common';
import { list } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const outputSchema = list(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
  }),
);

export const getRolesRouter = router({
  getRoles: networkAuthenticatedProcedure()
    .output(outputSchema)
    .query(async () => {
      const result = await getRoles();
      return { items: result.items };
    }),
});
