import { updateOrganizationUser } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.uuid(),
  organizationUserId: z.uuid(),
  data: z.object({
    name: z.string().optional(),
    email: z.email().optional(),
    about: z.string().optional(),
    roleIds: z.array(z.uuid()).optional(),
  }),
});

const outputSchema = z.object({
  id: z.string(),
  authUserId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  about: z.string().nullable(),
  organizationId: z.string(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
});

export const updateOrganizationUserRouter = router({
  updateOrganizationUser: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, organizationUserId, data } = input;
      const { user } = ctx;

      const updatedUser = await updateOrganizationUser({
        organizationUserId,
        organizationId,
        data,
        user,
      });

      return outputSchema.parse(updatedUser);
    }),
});
