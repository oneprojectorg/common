import { getOrgAccessUser } from '@op/common';
import { db } from '@op/db/client';
import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  email: z.email(),
  organizationId: z.uuid(),
});

const outputSchema = z.object({
  isMember: z.boolean(),
});

export const checkMembershipRouter = router({
  checkMembership: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 20 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .query(async ({ ctx, input }) => {
      const { email, organizationId } = input;
      const { user } = ctx;

      const orgUser = await getOrgAccessUser({
        user,
        organizationId,
      });

      assertAccess({ profile: permission.ADMIN }, orgUser?.roles ?? []);

      // Check if the target email is a member of the organization
      const membershipExists = await db._query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.email, email.toLowerCase()),
            eq(table.organizationId, organizationId),
          ),
      });

      return {
        isMember: !!membershipExists,
      };
    }),
});
