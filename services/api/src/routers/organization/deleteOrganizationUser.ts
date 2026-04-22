import { deleteOrganizationUser } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.uuid(),
  organizationUserId: z.uuid(),
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
});

export const deleteOrganizationUserRouter = router({
  deleteOrganizationUser: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 5 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, organizationUserId } = input;
      const { user } = ctx;

      const deletedUser = await deleteOrganizationUser({
        organizationUserId,
        organizationId,
        user,
      });

      return outputSchema.parse(deletedUser);
    }),
});
