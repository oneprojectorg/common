import { users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { ZodError, z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const endpoint = 'updateUserProfile';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PUT',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Update user profile',
  },
};

const updateUserProfile = router({
  updateUserProfile: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(
      z
        .object({
          name: z.string().trim().min(1).max(255),
          about: z.string().trim().max(255),
          title: z.string().trim().min(1).max(255),
          // underscore, numbers, lowercase letters
          username: z
            .string()
            .trim()
            .min(4)
            .max(255)
            .toLowerCase()
            .regex(/^[a-z0-9_]+$/),
        })
        .partial(),
    )
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;
      const { id } = ctx.user;

      let result;

      try {
        result = await db
          .update(users)
          .set({
            ...input,
          })
          .where(eq(users.authUserId, id))
          .returning();
      } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.includes('duplicate')) {
          throw new ZodError([
            {
              code: 'custom',
              message: 'Username already in use',
              path: ['username'],
              fatal: true,
            },
          ]);
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile',
        });
      }

      if (!result.length || !result[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Profile not found',
        });
      }

      return result[0];
    }),
});

export default updateUserProfile;
