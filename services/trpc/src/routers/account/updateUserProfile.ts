import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { z, ZodError } from 'zod';

import { profiles } from '@op/db/schema';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

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

const outputSchema = createSelectSchema(profiles);

const updateUserProfile = router({
  updateUserProfile: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(
      z.object({
        name: z.string().trim().min(1).max(255).optional(),
        avatarUrl: z.string().trim().url().optional(),
        about: z.string().trim().max(255).optional(),
        // underscore, numbers, lowercase letters
        username: z
          .string()
          .trim()
          .min(4)
          .max(255)
          .toLowerCase()
          .regex(/^[a-z0-9_]+$/)
          .optional(),
      }),
    )
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;
      const { id } = ctx.user;

      let result;

      try {
        result = await db
          .update(profiles)
          .set({
            ...input,
          })
          .where(eq(profiles.id, id))
          .returning();
      }
      catch (error) {
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

        console.error(error);

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
