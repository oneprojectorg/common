import { and, db, eq, or, sql } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError } from '../../utils';

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
export const getRelationships = async ({
  from,
  to,
  pending = null,
  directed = false,
}: {
  user: User;
  from: string;
  to?: string;
  pending?: boolean | null;
  directed?: boolean;
}) => {
  // const orgUser = await getOrgAccessUser({ user, organizationId: from });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  // if (!orgUser) {
  // throw new UnauthorizedError('You are not a member of this organization');
  // }
  //
  const andOr = directed ? and : or;
  const where = () =>
    andOr(
      eq(organizationRelationships.sourceOrganizationId, from),
      ...(to ? [eq(organizationRelationships.targetOrganizationId, to)] : []),
      ...(pending !== null
        ? [eq(organizationRelationships.pending, pending)]
        : []),
    );

  const [relationships, count] = await Promise.all([
    db.query.organizationRelationships.findMany({
      where,
      with: {
        targetOrganization: {
          with: {
            avatarImage: true,
          },
        },
      },
    }),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(organizationRelationships)
      .where(where),
  ]);

  return { records: relationships, count: count[0]?.count ?? 0 };
};

export const removeRelationship = async ({
  id,
}: {
  user: User;
  id: string;
}) => {
  // const orgUser = await getOrgAccessUser({ user, organizationId: from });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  // if (!orgUser) {
  // throw new UnauthorizedError('You are not a member of this organization');
  // }
  //

  try {
    await db
      .delete(organizationRelationships)
      .where(eq(organizationRelationships.id, id));

    return true;
  } catch (e) {
    throw new CommonError('Could not remove relationship');
  }
};
