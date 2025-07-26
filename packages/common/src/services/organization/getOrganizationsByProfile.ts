import { db, sql } from '@op/db/client';
import { locations } from '@op/db/schema';

export const getOrganizationsByProfile = async (profileId: string) => {
  // Find all users who have access to this profile
  // Either as their personal profile or as their current profile
  const usersWithProfile = await db.query.users.findMany({
    where: (table, { eq, or }) =>
      or(eq(table.profileId, profileId), eq(table.currentProfileId, profileId)),
    with: {
      organizationUsers: {
        with: {
          organization: {
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
            },
          },
        },
      },
    },
  });

  // Collect all unique organizations
  const organizationMap = new Map();

  for (const user of usersWithProfile) {
    for (const orgUser of user.organizationUsers) {
      if (orgUser.organization) {
        const org = orgUser.organization;

        // Transform whereWeWork to match expected format
        const transformedOrg = {
          ...org,
          whereWeWork: org.whereWeWork.map((item: any) => item.location),
        };

        organizationMap.set(org.id, transformedOrg);
      }
    }
  }

  return Array.from(organizationMap.values());
};
