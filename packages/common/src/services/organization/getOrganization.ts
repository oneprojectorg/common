import { db, eq, sql } from '@op/db/client';
import { locations, profiles } from '@op/db/schema';

import { NotFoundError } from '../../utils';

export const getOrganization = async ({ slug }: { slug: string }) => {
  if (!slug) {
    return;
  }

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.slug, slug))
    .limit(1);

  const profileId = profile?.[0]?.id;

  if (!profileId) {
    throw new NotFoundError('Could not find organization');
  }

  const org = await db._query.organizations.findFirst({
    where: (table, { eq }) => eq(table.profileId, profileId),
    with: {
      projects: true,
      links: true,
      profile: {
        with: {
          headerImage: true,
          avatarImage: true,
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
};
