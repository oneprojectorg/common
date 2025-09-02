import { db, eq, sql } from '@op/db/client';
import { locations, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';

export const getOrganization = async ({
  slug,
  id,
  user,
}: { user: User } & (
  | { id: string; slug?: undefined }
  | { id?: undefined; slug: string }
)) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  if (!slug && !id) {
    return;
  }

  try {
    const profile = slug
      ? await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.slug, slug))
          .limit(1)
      : null;

    const profileId = profile?.[0]?.id;

    if (!profileId) {
      throw new NotFoundError('Could not find organization');
    }

    const org = await db.query.organizations.findFirst({
      where: profileId
        ? (table, { eq }) => eq(table.profileId, profileId)
        : (table, { eq }) => eq(table.id, id!),
      with: {
        projects: true,
        links: true,
        profile: {
          with: {
            headerImage: true,
            avatarImage: true,
            modules: {
              with: {
                module: true,
              },
            },
          },
        },
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
                placeId: true,
                countryCode: true,
                countryName: true,
                metadata: true,
                latLng: false,
              },
            },
          },
        },
        // TODO: CONVERT TO TERMS
        strategies: {
          with: {
            term: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundError('Could not find organization');
    }

    org.whereWeWork = org.whereWeWork.map((record) => record.location);
    org.strategies = org.strategies.map((record) => record.term);

    return org;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
