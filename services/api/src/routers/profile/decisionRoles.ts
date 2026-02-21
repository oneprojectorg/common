import { getDecisionRoles, updateDecisionRoles } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const decisionRoleSchema = z.object({
  admin: z.boolean(),
  inviteMembers: z.boolean(),
  review: z.boolean(),
  submitProposals: z.boolean(),
  vote: z.boolean(),
});

export const decisionRolesRouter = router({
  getDecisionRoles: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        profileId: z.string().uuid(),
      }),
    )
    .output(decisionRoleSchema)
    .query(async ({ input }) => {
      return getDecisionRoles({
        roleId: input.roleId,
      });
    }),

  updateDecisionRoles: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        decisionPermissions: decisionRoleSchema,
      }),
    )
    .output(
      z.object({
        roleId: z.string(),
        decisionPermissions: decisionRoleSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return updateDecisionRoles({
        roleId: input.roleId,
        decisionPermissions: input.decisionPermissions,
        user: ctx.user,
      });
    }),
});
