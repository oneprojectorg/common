import {
  getDecisionCapabilities,
  updateDecisionCapabilities,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const decisionCapabilitiesSchema = z.object({
  admin: z.boolean(),
  inviteMembers: z.boolean(),
  review: z.boolean(),
  submitProposals: z.boolean(),
  vote: z.boolean(),
});

export const decisionCapabilitiesRouter = router({
  getDecisionCapabilities: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        profileId: z.string().uuid(),
      }),
    )
    .output(decisionCapabilitiesSchema)
    .query(async ({ input }) => {
      return getDecisionCapabilities({
        roleId: input.roleId,
      });
    }),

  updateDecisionCapabilities: commonAuthedProcedure()
    .input(
      z.object({
        roleId: z.string().uuid(),
        decisionPermissions: decisionCapabilitiesSchema,
      }),
    )
    .output(
      z.object({
        roleId: z.string(),
        decisionPermissions: decisionCapabilitiesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return updateDecisionCapabilities({
        roleId: input.roleId,
        decisionPermissions: input.decisionPermissions,
        user: ctx.user,
      });
    }),
});
