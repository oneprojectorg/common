import { db, sql } from '@op/db/client';
import { User } from '@op/supabase/lib';

export const getPlatformStats = async ({ user }: { user: User }) => {
  const lastLogin = new Date(user.last_sign_in_at ?? 0);
  const newOrgThreshold = new Date(lastLogin.setDate(lastLogin.getDate() - 7));

  const [result] = await db.execute<{
    total_organizations: number;
    total_users: number;
    total_relationships: number;
    new_organizations: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM organizations) AS total_organizations,
      (SELECT count(*)::int FROM users) AS total_users,
      (SELECT count(*)::int FROM organization_relationships WHERE NOT pending) AS total_relationships,
      (SELECT count(*)::int FROM organizations WHERE created_at >= ${newOrgThreshold.toISOString()}) AS new_organizations
  `);

  return {
    totalOrganizations: result?.total_organizations ?? 0,
    totalUsers: result?.total_users ?? 0,
    totalRelationships: result?.total_relationships ?? 0,
    newOrganizations: result?.new_organizations ?? 0,
  };
};
