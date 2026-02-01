import { createRole } from '@op/common';
import { z } from 'zod';

import { permissionsSchema } from '../../encoders/access';
import { roleEncoder } from '../../encoders/roles';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const createRoleRouter = router({
  createRole: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.string().uuid(),
        zoneName: z.string(),
        name: z.string().min(1).max(255),
        permissions: permissionsSchema,
      }),
    )
    .output(roleEncoder.required({ permissions: true }))
    .mutation(async ({ ctx, input }) => {
      return createRole({
        name: input.name,
        zoneName: input.zoneName,
        permissions: input.permissions,
        profileId: input.profileId,
        user: ctx.user,
      });
    }),
});
