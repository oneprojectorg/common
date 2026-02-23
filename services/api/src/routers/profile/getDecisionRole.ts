import { getDecisionRole } from '@op/common';
import { z } from 'zod';

import { decisionRoleEncoder } from '../../encoders/access';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const getDecisionRoleRouter = router({
  getDecisionRole: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        profileId: z.string().uuid(),
      }),
    )
    .output(decisionRoleEncoder)
    .query(async ({ input }) => {
      return getDecisionRole({
        roleId: input.roleId,
      });
    }),
});
