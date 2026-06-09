import { getDecisionRole } from '@op/common';
import { z } from 'zod';

import { decisionRoleEncoder } from '../../encoders/access';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const getDecisionRoleRouter = router({
  getDecisionRole: networkAuthenticatedProcedure()
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
        profileId: input.profileId,
      });
    }),
});
