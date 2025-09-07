import { db, sql } from '@op/db/client';
import { locations, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';

export const searchProfilesLocations = async ({
  user,
  bounds,
  limit = 50,
}: {
  user: User;
  bounds: { north: number; south: number; east: number; west: number };
  limit?: number;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  try {

    // Use Drizzle query builder instead of raw SQL for better type safety
    const result = await db.query.profiles.findMany({
      where: sql`EXISTS (
        SELECT 1 FROM "organizations_where_we_work" oww
        JOIN locations l ON oww.location_id = l.id
        JOIN organizations org ON oww.organization_id = org.id
        WHERE org.profile_id = ${profiles.id}
        AND ST_Contains(
          ST_MakeEnvelope(${sql.raw(bounds.west.toString())}, ${sql.raw(bounds.south.toString())}, ${sql.raw(bounds.east.toString())}, ${sql.raw(bounds.north.toString())}, 4326),
          l.location
        )
      )`,
      with: {
        avatarImage: true,
        organization: {
          with: {
            whereWeWork: {
              with: {
                location: {
                  extras: {
                    x: sql<number>`ST_X(${locations.location})`.as('x'),
                    y: sql<number>`ST_Y(${locations.location})`.as('y'),
                  },
                  columns: {
                    id: true,
                    name: true,
                    countryCode: true,
                    countryName: true,
                  },
                },
              },
            },
          },
        },
      },
      limit,
    });


    // Transform the result into the expected profile format
    const items = result.map((profile) => ({
      id: profile.id,
      name: profile.name,
      type: profile.type,
      bio: profile.bio,
      website: profile.website,
      email: profile.email,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      avatarImage: profile.avatarImage,
      organization: profile.organization
    }));

    return { items, hasMore: false, next: null };
  } catch (error) {
    console.error('Error in searchProfilesLocations:', error);
    throw error;
  }
};