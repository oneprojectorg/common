import { db } from '@op/db/client';
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
}: {
  user: User;
  from: string;
  to: string;
}) => {
  // const orgUser = await getOrgAccessUser({ user, organizationId: from });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  // if (!orgUser) {
  // throw new UnauthorizedError('You are not a member of this organization');
  // }

  const relationships = await db.query.organizationRelationships.findMany({
    where: (table, { and, eq }) =>
      and(
        eq(table.sourceOrganizationId, from),
        eq(table.targetOrganizationId, to),
      ),
  });

  return relationships;
};
