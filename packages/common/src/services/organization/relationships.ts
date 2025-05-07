import { and, db, eq, sql } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { User } from '@op/supabase/lib';

export const addRelationship = async ({
  from,
  to,
  relationships,
}: {
  user: User;
  from: string;
  to: string;
  relationships: Array<string>;
}) => {
  // const orgUser = await getOrgAccessUser({ user, organizationId: from });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  // if (!orgUser) {
  // throw new UnauthorizedError('You are not a member of this organization');
  // }

  await db.transaction(async (tx) => {
    await Promise.all(
      relationships.map((relationship) =>
        tx
          .insert(organizationRelationships)
          .values({
            sourceOrganizationId: from,
            targetOrganizationId: to,
            relationshipType: relationship,
            pending: true,
          })
          .onConflictDoNothing(),
      ),
    );
  });
};

// TODO: this can be a heavy query if we don't watch it
export const getRelationship = async ({
  from,
  to,
  pending = null,
}: {
  user: User;
  from: string;
  to: string;
  pending?: boolean | null;
}) => {
  // const orgUser = await getOrgAccessUser({ user, organizationId: from });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  // if (!orgUser) {
  // throw new UnauthorizedError('You are not a member of this organization');
  // }
  //
  const where = () =>
    and(
      eq(organizationRelationships.sourceOrganizationId, from),
      eq(organizationRelationships.targetOrganizationId, to),
      ...(pending !== null
        ? [eq(organizationRelationships.pending, pending)]
        : []),
    );

  const [relationships, count] = await Promise.all([
    db.query.organizationRelationships.findMany({
      where,
    }),
    db
      .select({
        count: sql`count(*)::int`,
      })
      .from(organizationRelationships)
      .where(where),
  ]);

  return { records: relationships, count: count[0]?.count ?? 0 };
};
