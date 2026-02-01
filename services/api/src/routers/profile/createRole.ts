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
        name: z.string().min(1).max(255),
        permissions: permissionsSchema,
      }),
    )
    .output(roleEncoder.required({ permissions: true }))
    .mutation(async ({ ctx, input }) => {
      const role = await createRole({
        name: input.name,
        permissions: { decisions: input.permissions },
        profileId: input.profileId,
        user: ctx.user,
      });

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: input.permissions,
      };
    }),
});
