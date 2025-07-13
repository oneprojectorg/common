import { db, eq, gte, sql } from '@op/db/client';
import { organizationRelationships, organizations, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

export const getOrganizationStats = async ({ user }: { user: User }) => {
  const lastLogin = new Date(user.last_sign_in_at ?? 0);
  const newOrgThreshold = new Date(lastLogin.setDate(lastLogin.getDate() - 7));

  const [orgCount, usersCount, relationshipCount, newOrganizationsCount] =
    await db.transaction(async (tx) => {
      const results = await Promise.all([
        tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(organizations),

        tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(users),

        tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(organizationRelationships)
          .where(() => eq(organizationRelationships.pending, false)),

        tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(organizations)
          .where(gte(organizations.createdAt, newOrgThreshold.toISOString())),
      ]);

      return results;
    });

  const totalOrganizations = orgCount[0]?.count ?? 0;
  const totalUsers = usersCount[0]?.count ?? 0;
  const totalRelationships = relationshipCount[0]?.count ?? 0;
  const newOrganizations = newOrganizationsCount[0]?.count ?? 0;

  return {
    totalOrganizations,
    totalUsers,
    totalRelationships,
    newOrganizations,
  };
};
