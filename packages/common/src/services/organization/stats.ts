import { db, eq, gte, sql } from '@op/db/client';
import { organizationRelationships, organizations } from '@op/db/schema';
import { User } from '@op/supabase/lib';

export const getOrganizationStats = async ({ user }: { user: User }) => {
  const lastLogin = new Date(user.last_sign_in_at ?? 0);
  const newOrgThreshold = new Date(lastLogin.setDate(lastLogin.getDate() - 7));

  const [orgCount, relationshipCount, newOrganizationsCount] =
    await db.transaction(async (tx) => {
      const orgCount = tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(organizations);

      const relationshipCount = tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(organizationRelationships)
        .where(() => eq(organizationRelationships.pending, false));

      const newOrganizationsCount = tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(organizations)
        .where(gte(organizations.createdAt, newOrgThreshold.toISOString()));

      const results = Promise.all([
        orgCount,
        relationshipCount,
        newOrganizationsCount,
      ]);

      return results;
    });

  const totalOrganizations = orgCount[0]?.count ?? 0;
  const totalRelationships = relationshipCount[0]?.count ?? 0;
  const newOrganizations = newOrganizationsCount[0]?.count ?? 0;

  return { totalOrganizations, totalRelationships, newOrganizations };
};
