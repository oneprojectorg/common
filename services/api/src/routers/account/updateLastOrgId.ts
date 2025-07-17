import { users, organizations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const endpoint = 'updateLastOrgId';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PUT',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Update user lastOrgId',
  },
};

export const switchOrganization = router({
  switchOrganization: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;
      const { id } = ctx.user;

      let result;
      try {
        // First, get the organization to find its profile ID
        const organization = await db.query.organizations.findFirst({
          where: eq(organizations.id, input.organizationId),
        });

        if (!organization) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Organization not found',
          });
        }

        result = await db
          .update(users)
          .set({ currentProfileId: organization.profileId })
          .where(eq(users.authUserId, id))
          .returning();
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update currentProfileId',
        });
      }

      if (!result.length || !result[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return userEncoder.parse(result[0]);
    }),
});

