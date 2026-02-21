import { getDecisionRoles } from '@op/common';
import { z } from 'zod';

import { decisionRoleEncoder } from '../../encoders/access';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const getDecisionRolesRouter = router({
  getDecisionRoles: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        profileId: z.string().uuid(),
      }),
    )
    .output(decisionRoleEncoder)
    .query(async ({ input }) => {
      return getDecisionRoles({
        roleId: input.roleId,
      });
    }),
});
