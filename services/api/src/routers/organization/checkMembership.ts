import { CommonError, getOrgAccessUser } from '@op/common';
import { db } from '@op/db/client';
import { TRPCError } from '@trpc/server';
import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withAnalytics from '../../middlewares/withAnalytics';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  email: z.string().email(),
  organizationId: z.string().uuid(),
});

const outputSchema = z.object({
  isMember: z.boolean(),
});

export const checkMembershipRouter = router({
  checkMembership: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(inputSchema)
    .output(outputSchema)
    .query(async ({ ctx, input }) => {
      const { email, organizationId } = input;
      const { user } = ctx;

      try {
        const orgUser = await getOrgAccessUser({
          user,
          organizationId,
        });

        assertAccess({ profile: permission.ADMIN }, orgUser?.roles ?? []);

        // Check if the target email is a member of the organization
        const membershipExists = await db.query.organizationUsers.findFirst({
          where: (table, { and, eq }) =>
            and(
              eq(table.email, email.toLowerCase()),
              eq(table.organizationId, organizationId),
            ),
        });

        return {
          isMember: !!membershipExists,
        };
      } catch (error) {
        if (error instanceof CommonError) {
          throw error;
        }

        console.log('Error', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check membership status',
        });
      }
    }),
});
