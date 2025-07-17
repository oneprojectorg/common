import { NotFoundError, getProfile } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { profileEncoder } from '../../encoders/profiles';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  slug: z.string(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/profile/{slug}',
    protect: true,
    tags: ['profile'],
    summary: 'Get profile by slug',
  },
};

// Use the profile encoder directly
const universalProfileSchema = profileEncoder;

export const getProfileRouter = router({
  getBySlug: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(inputSchema)
    .output(universalProfileSchema)
    .query(async ({ ctx, input }) => {
      const { slug } = input;
      const { user } = ctx;
      const { db } = ctx.database;

      try {
        // Use the profile service to get profile data
        const profile = await getProfile({
          slug,
          user,
          database: db,
        });

        // Return the profile data using the profile encoder
        return universalProfileSchema.parse(profile);
      } catch (error: unknown) {
        console.log(error);
        
        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: error.message,
            code: 'NOT_FOUND',
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          message: 'Profile not found',
          code: 'NOT_FOUND',
        });
      }
    }),
});