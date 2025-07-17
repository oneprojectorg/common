import { sql } from '@op/db/client';
import { locations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/by-profile/{profileId}',
    protect: true,
    tags: ['organization'],
    summary: 'Get organizations by profile access',
  },
};

export const getOrganizationsByProfileRouter = router({
  getOrganizationsByProfile: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(z.object({ profileId: z.string().uuid() }))
    .output(z.array(organizationsEncoder))
    .query(async ({ input, ctx }) => {
      const { db } = ctx.database;
      const { profileId } = input;

      try {
        // Find all users who have access to this profile
        // Either as their personal profile or as their current profile
        const usersWithProfile = await db.query.users.findMany({
          where: (table, { eq, or }) =>
            or(
              eq(table.profileId, profileId),
              eq(table.currentProfileId, profileId),
            ),
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

        const organizations = Array.from(organizationMap.values());

        return organizations.map((org) => organizationsEncoder.parse(org));
      } catch (error) {
        console.error('Error getting organizations by profile:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get organizations by profile',
        });
      }
    }),
});
