import { searchProfilesLocations } from '@op/common';
import { EntityType } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/profile/search-by-bounds',
    protect: true,
    tags: ['profile'],
    summary: 'Search profiles within geographical bounds',
  },
};

const boundsSchema = z.object({
  north: z.number(),
  south: z.number(),
  east: z.number(),
  west: z.number(),
});

export const searchProfilesByBoundsRouter = router({
  searchByBounds: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // Router
    .meta(meta)
    .input(
      z.object({
        bounds: boundsSchema,
        types: z.array(z.nativeEnum(EntityType)).optional(),
        limit: z.number().min(1).max(100).optional().default(50),
      }).refine((input) => 
        input.bounds.north !== undefined && 
        input.bounds.south !== undefined && 
        input.bounds.east !== undefined && 
        input.bounds.west !== undefined,
        {
          message: 'All bounds properties (north, south, east, west) are required',
        }
      ),
    )
    .output(z.array(z.any()))
    .query(async ({ ctx, input }) => {
      const { bounds, limit } = input;

      try {

        // TODO: use a cache
        //
        // const result = await cache<ReturnType<typeof listProfiles>>({
        //   type: 'search',
        //   params: [ctx.user.id,bounds],
        //   options: {
        //     ttl: 30 * 1000,
        //   },
        //   fetch: () =>
        //      searchProfilesLocations({
        //       user: ctx.user,
        //       bounds,
        //       limit,
        //     }),
        // });

        const result = await searchProfilesLocations({
          user: ctx.user,
          bounds,
          limit,
        });

        if (!result) {
          throw new TRPCError({
            message: 'Profiles not found',
            code: 'NOT_FOUND',
          });
        }

        return result.items.map((profile: any) => {
          // Handle null avatarImage
          if (profile.avatarImage?.id == null) {
            profile.avatarImage = null;
          }
          return profile;
        });
      } catch (error) {
        console.error('Error in searchProfilesByBounds:', error);
        throw new TRPCError({
          message: 'Failed to search profiles by bounds',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});