import { getRoles } from '@op/common';
import { z } from 'zod';

import { roleEncoder } from '../../encoders/roles';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z
  .object({
    slug: z.string().optional(),
  })
  .optional();

export const rolesRouter = router({
  listRoles: commonAuthedProcedure()
    .input(inputSchema)
    .output(z.array(roleEncoder))
    .query(async ({ input }) => {
      const result = await getRoles({ profileSlug: input?.slug });

      return result.map((role) => roleEncoder.parse(role));
    }),
});
