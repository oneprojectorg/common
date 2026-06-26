import { cache } from '@op/cache';
import { db, sql } from '@op/db/client';
import { User } from '@op/supabase/lib';

const STATS_TTL = 5 * 60 * 1000; // 5 minutes

// Platform-wide counts that are identical for every user. Cached under a single
// shared key so the cost is paid once per TTL for the whole platform rather
// than once per (user, login-day) — the previous key embedded a per-user
// threshold, which fragmented the cache so badly it effectively never reused an
// entry.
const getGlobalStats = () =>
  cache<{
    totalOrganizations: number;
    totalUsers: number;
    totalRelationships: number;
  }>({
    type: 'platform',
    params: ['stats', 'global'],
    fetch: async () => {
      const [result] = await db.execute<{
        total_organizations: number;
        total_users: number;
        total_relationships: number;
      }>(sql`
        SELECT
          (SELECT GREATEST(reltuples, 0)::int FROM pg_class WHERE relname = 'organizations' AND relnamespace = 'public'::regnamespace) AS total_organizations,
          (SELECT GREATEST(reltuples, 0)::int FROM pg_class WHERE relname = 'users' AND relnamespace = 'public'::regnamespace) AS total_users,
          (SELECT count(*)::int FROM organization_relationships WHERE NOT pending) AS total_relationships
      `);

      return {
        totalOrganizations: result?.total_organizations ?? 0,
        totalUsers: result?.total_users ?? 0,
        totalRelationships: result?.total_relationships ?? 0,
      };
    },
    options: {
      ttl: STATS_TTL,
    },
  });

// "New since you were last here" count — inherently per-user. Keyed by the
// (day-quantized) threshold so users that share a threshold share the entry,
// and the count itself is a cheap index scan on organizations.created_at.
// Returns an object (not a bare number) so a legitimate `0` is still truthy
// and gets cached, instead of falling through to the DB on every request.
const getNewOrganizationsCount = (newOrgThreshold: Date) =>
  cache<{ newOrganizations: number }>({
    type: 'platform',
    params: ['stats', 'new-orgs', newOrgThreshold.toISOString()],
    fetch: async () => {
      const [result] = await db.execute<{ new_organizations: number }>(sql`
        SELECT count(*)::int AS new_organizations
        FROM organizations
        WHERE created_at >= ${newOrgThreshold.toISOString()}
      `);

      return { newOrganizations: result?.new_organizations ?? 0 };
    },
    options: {
      ttl: STATS_TTL,
    },
  });

export const getPlatformStats = async ({ user }: { user: User }) => {
  const lastLogin = new Date(user.last_sign_in_at ?? 0);
  const newOrgThreshold = new Date(lastLogin.setDate(lastLogin.getDate() - 7));
  newOrgThreshold.setHours(0, 0, 0, 0);

  const [globalStats, { newOrganizations }] = await Promise.all([
    getGlobalStats(),
    getNewOrganizationsCount(newOrgThreshold),
  ]);

  return {
    ...globalStats,
    newOrganizations,
  };
};
