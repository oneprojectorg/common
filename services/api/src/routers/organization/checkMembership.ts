import { assertOrgAccess } from '@op/common';
import { db } from '@op/db/client';
import { permission } from 'access-zones';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  email: z.email(),
  organizationId: z.uuid(),
});

const outputSchema = z.object({
  isMember: z.boolean(),
});

export const checkMembershipRouter = router({
  checkMembership: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 20 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .query(async ({ ctx, input }) => {
      const { email, organizationId } = input;
      const { user } = ctx;

      await assertOrgAccess({
        user,
        organizationId,
        permissions: { profile: permission.ADMIN },
      });

      // Check if the target email is a member of the organization
      const membershipExists = await db.query.organizationUsers.findFirst({
        where: {
          email: email.toLowerCase(),
          organizationId,
        },
      });

      return {
        isMember: !!membershipExists,
      };
    }),
});
