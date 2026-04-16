import { cache } from '@op/cache';
import { db, sql } from '@op/db/client';
import { User } from '@op/supabase/lib';

const STATS_TTL = 5 * 60 * 1000; // 5 minutes

export const getPlatformStats = async ({ user }: { user: User }) => {
  const lastLogin = new Date(user.last_sign_in_at ?? 0);
  const newOrgThreshold = new Date(lastLogin.setDate(lastLogin.getDate() - 7));
  newOrgThreshold.setHours(0, 0, 0, 0);

  return cache<{
    totalOrganizations: number;
    totalUsers: number;
    totalRelationships: number;
    newOrganizations: number;
  }>({
    type: 'platform',
    params: ['stats', newOrgThreshold.toISOString()],
    fetch: async () => {
      const [result] = await db.execute<{
        total_organizations: number;
        total_users: number;
        total_relationships: number;
        new_organizations: number;
      }>(sql`
        SELECT
          (SELECT GREATEST(reltuples, 0)::int FROM pg_class WHERE relname = 'organizations' AND relnamespace = 'public'::regnamespace) AS total_organizations,
          (SELECT GREATEST(reltuples, 0)::int FROM pg_class WHERE relname = 'users' AND relnamespace = 'public'::regnamespace) AS total_users,
          (SELECT count(*)::int FROM organization_relationships WHERE NOT pending) AS total_relationships,
          (SELECT count(*)::int FROM organizations WHERE created_at >= ${newOrgThreshold.toISOString()}) AS new_organizations
      `);

      return {
        totalOrganizations: result?.total_organizations ?? 0,
        totalUsers: result?.total_users ?? 0,
        totalRelationships: result?.total_relationships ?? 0,
        newOrganizations: result?.new_organizations ?? 0,
      };
    },
    options: {
      ttl: STATS_TTL,
    },
  });
};
