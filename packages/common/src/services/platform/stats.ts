import { cache } from '@op/cache';
import { db, eq, gte, sql } from '@op/db/client';
import { organizationRelationships, organizations, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

const PLATFORM_STATS_TTL = 5 * 60 * 1000; // 5 minutes

export const getPlatformStats = async ({ user }: { user: User }) => {
  const lastLogin = new Date(user.last_sign_in_at ?? 0);
  const newOrgThreshold = new Date(lastLogin.setDate(lastLogin.getDate() - 7));
  // Round to the nearest hour so cache keys are shared across users with similar login times
  const thresholdKey = newOrgThreshold.toISOString().slice(0, 13);

  return cache({
    type: 'search',
    params: ['platform-stats', thresholdKey],
    fetch: async () => {
      const [orgCount, usersCount, relationshipCount, newOrganizationsCount] =
        await Promise.all([
          db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(organizations),

          db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(users),

          db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(organizationRelationships)
            .where(() => eq(organizationRelationships.pending, false)),

          db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(organizations)
            .where(gte(organizations.createdAt, newOrgThreshold.toISOString())),
        ]);

      return {
        totalOrganizations: orgCount[0]?.count ?? 0,
        totalUsers: usersCount[0]?.count ?? 0,
        totalRelationships: relationshipCount[0]?.count ?? 0,
        newOrganizations: newOrganizationsCount[0]?.count ?? 0,
      };
    },
    options: {
      ttl: PLATFORM_STATS_TTL,
    },
  });
};
