import { cache } from '@op/cache';
import { db, sql } from '@op/db/client';

const STATS_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * `lastSignInAt` anchors the "new organizations since you were last here"
 * cache window. It's the only field of the caller's identity this function
 * reads, so we take it directly rather than dragging the full Supabase
 * `User` shape through the type system — the router extracts it from the
 * authoritative `UserResponse` (which the network-tier middleware has
 * already fetched and cached).
 */
export const getPlatformStats = async ({
  lastSignInAt,
}: {
  lastSignInAt: string | null | undefined;
}) => {
  const lastLogin = new Date(lastSignInAt ?? 0);
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
