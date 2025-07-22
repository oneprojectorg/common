import { updateUserProfile as updateUserProfileService } from '@op/common';
import { TRPCError } from '@trpc/server';
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
          bio: z.string().trim().max(255),
          title: z.string().trim().min(1).max(255),
          // underscore, numbers, lowercase letters
          username: z
            .string()
            .trim()
            .min(4)
            .max(255)
            .toLowerCase()
            .regex(/^[a-z0-9_]+$/),
          email: z
            .string()
            .email({ message: 'Invalid email' })
            .max(255, { message: 'Must be at most 255 characters' }),
          website: z
            .string()
            .trim()
            .max(255, { message: 'Must be at most 255 characters' }),
          focusAreas: z.array(z.object({
            id: z.string(),
            label: z.string(),
          })),
        })
        .partial(),
    )
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;
      const { user } = ctx;

      try {
        const result = await updateUserProfileService({
          input,
          user,
          db,
        });

        return userEncoder.parse(result);
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
    }),
});

export default updateUserProfile;
