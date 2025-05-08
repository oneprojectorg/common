import { and, db, eq, or, sql } from '@op/db/client';
import { Organization, organizationRelationships } from '@op/db/schema';
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
export const getRelatedOrganizations = async ({
  orgId,
  pending = null,
}: {
  user: User;
  orgId: string;
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
    or(
      eq(organizationRelationships.sourceOrganizationId, orgId),
      eq(organizationRelationships.targetOrganizationId, orgId),
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
        sourceOrganization: {
          with: {
            avatarImage: true,
          },
        },
      },
    }),
    // TODO: this doesn't count the right thing. It counts the relationships rather than the orgs in relationship
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(organizationRelationships)
      .where(where),
  ]);

  // At the moment we combine all the relationships into one distinct org record
  // in JS as this is harder to do in SQL
  const distinctRelationships = new Map<
    string,
    Organization & {
      relationships?: Array<{
        relationshipType: string;
        pending: boolean | null;
        createdAt: string | null;
      }>;
    }
  >();

  relationships.forEach((relationship) => {
    const relatedOrg = (
      relationship.sourceOrganizationId === orgId
        ? relationship.targetOrganization
        : relationship.sourceOrganization
    ) as Organization;

    if (!distinctRelationships.has(relatedOrg.id)) {
      distinctRelationships.set(relatedOrg.id, relatedOrg);
    }

    const org = distinctRelationships.get(relatedOrg.id);
    const relationshipRecord = {
      relationshipType: relationship.relationshipType,
      pending: relationship.pending,
      createdAt: relationship.createdAt,
    };

    if (org?.relationships) {
      org.relationships?.push(relationshipRecord);
    } else if (org) {
      org.relationships = [relationshipRecord];
    }
  });

  const organizations = Array.from(distinctRelationships).map(
    ([_, val]) => val,
  );

  return { records: organizations, count: count[0]?.count ?? 0 };
};

export const getDirectedRelationships = async ({
  from,
  to,
  pending = null,
}: {
  user: User;
  from: string;
  to?: string;
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
        sourceOrganization: {
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
