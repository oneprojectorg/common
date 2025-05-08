import { db, eq, gte, sql } from '@op/db/client';
import { organizationRelationships, organizations } from '@op/db/schema';
import { User } from '@op/supabase/lib';

export const getOrganizationStats = async ({ user }: { user: User }) => {
  const lastLogin = new Date(user.last_sign_in_at ?? 0);
  const newOrgThreshold = new Date(lastLogin.setDate(lastLogin.getDate() - 7));

  const [orgCount, relationshipCount, newOrganizationsCount] =
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
        .from(organizationRelationships)
        .where(() => eq(organizationRelationships.pending, false)),
      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(organizations)
        .where(gte(organizations.createdAt, newOrgThreshold.toISOString())),
    ]);

  const totalOrganizations = orgCount[0]?.count ?? 0;
  const totalRelationships = relationshipCount[0]?.count ?? 0;
  const newOrganizations = newOrganizationsCount[0]?.count ?? 0;

  return { totalOrganizations, totalRelationships, newOrganizations };
};
