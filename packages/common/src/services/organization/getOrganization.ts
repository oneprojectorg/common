import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';

import { NotFoundError } from '../../utils';

export const getOrganization = async ({ slug }: { slug: string }) => {
  if (!slug) {
    throw new NotFoundError('Organization not found');
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

  const org = await db.query.organizations.findFirst({
    where: { profileId },
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
              x: (table, { sql }) =>
                sql<number>`ST_X(${table.location})`.as('x'),
              y: (table, { sql }) =>
                sql<number>`ST_Y(${table.location})`.as('y'),
            },
            columns: {
              id: true,
              name: true,
              placeId: true,
              countryCode: true,
              countryName: true,
              metadata: true,
            },
          },
        },
      },
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

  return {
    ...org,
    whereWeWork: org.whereWeWork.map((record) => record.location),
    strategies: org.strategies.map((record) => record.term),
  };
};
