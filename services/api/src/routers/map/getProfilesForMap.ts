import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { profiles, locations } from '@op/db/schema';
import { profileEncoder } from '../../encoders/profiles';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }).optional(),
  filters: z.object({
    profileTypes: z.array(z.enum(['individual', 'organization'])).optional(),
    focusAreas: z.array(z.string()).optional(),
    organizationTypes: z.array(z.string()).optional(),
  }).optional(),
  limit: z.number().default(500),
});

const getProfilesForMapMeta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/map/profiles',
    protect: true,
    tags: ['map'],
    summary: 'Get profiles with geographic data for map visualization',
  },
};

export const getProfilesForMapRouter = router({
  getProfilesForMap: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(getProfilesForMapMeta)
    .input(inputSchema)
    .output(z.array(z.object({
      profile: profileEncoder,
      location: z.object({
        id: z.string(),
        name: z.string().nullable(),
        address: z.string().nullable(),
        plusCode: z.string().nullable(),
        latitude: z.number(),
        longitude: z.number(),
        countryCode: z.string().nullable(),
        countryName: z.string().nullable(),
      }).nullable(),
    })))
    .query(async ({ ctx, input }) => {
      const { bounds, filters: _filters, limit } = input;
      const { db } = ctx.database;
      const { user: _user } = ctx;

      try {
        // Build the base query
        let query = db
          .select({
            profile: profiles,
            location: {
              id: locations.id,
              name: locations.name,
              address: locations.address,
              plusCode: locations.plusCode,
              latitude: sql<number>`ST_Y(${locations.location})`.as('latitude'),
              longitude: sql<number>`ST_X(${locations.location})`.as('longitude'),
              countryCode: locations.countryCode,
              countryName: locations.countryName,
            },
          })
          .from(profiles)
          .leftJoin(locations, sql`${profiles.primaryLocationId} = ${locations.id}`)
          .where(
            // Only show profiles with valid locations
            sql`${locations.location} IS NOT NULL`
          );

        // Apply geographic bounds if provided
        // TODO: Fix bounds filtering - currently disabled due to query structure
        if (bounds) {
          // This would need to be combined with the existing where clause above
          // query = query.where(
          //   sql`ST_Within(
          //     ${locations.location}, 
          //     ST_SetSRID(ST_MakeEnvelope(
          //       ${bounds.west}, ${bounds.south}, 
          //       ${bounds.east}, ${bounds.north}
          //     ), 4326)
          //   )`
          // );
        }

        // Apply limit
        const finalQuery = query.limit(limit);

        const result = await finalQuery;

        // Apply server-side privacy filtering  
        const filteredResult = result.map((item: any) => {
          // Basic privacy check - in production, implement proper access controls
          const canSeeExactLocation = true; // Replace with actual privacy logic
          
          if (!canSeeExactLocation && item.location) {
            return {
              profile: item.profile,
              location: {
                ...item.location,
                // Approximate location for privacy
                latitude: Math.round(item.location.latitude * 100) / 100,
                longitude: Math.round(item.location.longitude * 100) / 100,
                address: null, // Hide exact address
              },
            };
          }
          
          return item;
        });

        return filteredResult;
      } catch (error: unknown) {
        console.error('Error fetching profiles for map:', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          message: 'Failed to fetch map data',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});