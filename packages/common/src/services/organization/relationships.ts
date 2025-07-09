import { and, db, eq, or } from '@op/db/client';
import {
  Organization,
  Profile,
  organizationRelationships,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { relationshipMap } from '@op/types';

import { CommonError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

type OrganizationWithProfile = Organization & {
  profile: Profile & { avatarImage: any };
};

export const addRelationship = async ({
  user,
  from,
  to,
  relationships,
}: {
  user: User;
  from: string;
  to: string;
  relationships: Array<string>;
}) => {
  const orgUser = await getOrgAccessUser({ user, organizationId: from });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

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
    and(
      or(
        eq(organizationRelationships.sourceOrganizationId, orgId),
        eq(organizationRelationships.targetOrganizationId, orgId),
      ),
      ...(pending !== null
        ? [eq(organizationRelationships.pending, pending)]
        : []),
    );

  const relationships = await db.query.organizationRelationships.findMany({
    where,
    with: {
      targetOrganization: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
      sourceOrganization: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
    },
  });

  // At the moment we combine all the relationships into one distinct org record
  // in JS as this is harder to do in SQL
  const distinctRelationships = new Map<
    string,
    OrganizationWithProfile & {
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
    ) as OrganizationWithProfile;

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

  // TODO: do this through SQL
  return { records: organizations, count: organizations.length ?? 0 };
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
  const [relationships, inverseRelationships] = await Promise.all([
    db.query.organizationRelationships.findMany({
      where: () =>
        and(
          eq(organizationRelationships.sourceOrganizationId, from),
          ...(to
            ? [eq(organizationRelationships.targetOrganizationId, to)]
            : []),
          ...(pending !== null
            ? [eq(organizationRelationships.pending, pending)]
            : []),
        ),
      with: {
        targetOrganization: {
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
          },
        },
        sourceOrganization: {
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
          },
        },
      },
    }),
    db.query.organizationRelationships.findMany({
      where: () =>
        and(
          eq(organizationRelationships.targetOrganizationId, from),
          ...(to
            ? [eq(organizationRelationships.sourceOrganizationId, to)]
            : []),
          ...(pending !== null
            ? [eq(organizationRelationships.pending, pending)]
            : []),
        ),
      with: {
        targetOrganization: {
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
          },
        },
        sourceOrganization: {
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // transform the inverse relationships to the proper direction
  // TODO: Store these in the DB for easier traversal
  const redirectedInverseRelationships = inverseRelationships.map(
    (relationship) => {
      const inverse = {
        ...relationship,
        // swap the relationship
        sourceOrganizationId: relationship.targetOrganizationId,
        sourceOrganization: relationship.targetOrganization,
        targetOrganizationId: relationship.sourceOrganizationId,
        targetOrganization: relationship.sourceOrganization,

        relationshipType:
          relationshipMap[relationship.relationshipType]?.inverse ??
          relationship.relationshipType,
      };
      return inverse;
    },
  );

  const allRelationships = relationships.concat(redirectedInverseRelationships);

  return {
    records: allRelationships,
    count: allRelationships.length,
  };
};

export const getPendingRelationships = async ({
  user,
  orgId,
}: {
  user: User;
  orgId: string;
}) => {
  const orgUser = await getOrgAccessUser({ user, organizationId: orgId });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  const where = () =>
    and(
      eq(organizationRelationships.targetOrganizationId, orgId),
      eq(organizationRelationships.pending, true),
    );

  const [relationships] = await Promise.all([
    db.query.organizationRelationships.findMany({
      where,
      with: {
        targetOrganization: {
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
          },
        },
        sourceOrganization: {
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // At the moment we combine all the relationships into one distinct org record
  // in JS as this is harder to do in SQL
  const distinctRelationships = new Map<
    string,
    OrganizationWithProfile & {
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
    ) as OrganizationWithProfile;

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

  return { records: organizations, count: organizations.length };
};

export const removeRelationship = async ({
  id,
}: {
  id: string;
  user: User;
}) => {
  // const orgUser = await getOrgAccessUser({ user, organizationId: user });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  // if (!orgUser) {
  // throw new UnauthorizedError('You are not a member of this organization');
  // }

  try {
    await db
      .delete(organizationRelationships)
      .where(eq(organizationRelationships.id, id));

    return true;
  } catch (e) {
    throw new CommonError('Could not remove relationship');
  }
};

export const approveRelationship = async ({
  targetOrganizationId,
  sourceOrganizationId,
  user,
}: {
  user: User;
  targetOrganizationId: string;
  sourceOrganizationId: string;
}) => {
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: targetOrganizationId,
  });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  try {
    await db
      .update(organizationRelationships)
      .set({ pending: false })
      .where(
        and(
          eq(
            organizationRelationships.targetOrganizationId,
            targetOrganizationId,
          ),
          eq(
            organizationRelationships.sourceOrganizationId,
            sourceOrganizationId,
          ),
        ),
      )
      .execute();

    return true;
  } catch (e) {
    throw new CommonError('Could not approve relationship');
  }
};

export const declineRelationship = async ({
  targetOrganizationId,
  sourceOrganizationId,
  user,
}: {
  user: User;
  targetOrganizationId: string;
  sourceOrganizationId: string;
}) => {
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: targetOrganizationId,
  });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  try {
    await db
      .delete(organizationRelationships)
      .where(
        and(
          eq(
            organizationRelationships.targetOrganizationId,
            targetOrganizationId,
          ),
          eq(
            organizationRelationships.sourceOrganizationId,
            sourceOrganizationId,
          ),
        ),
      )
      .execute();

    return true;
  } catch (e) {
    throw new CommonError('Could not decline relationship');
  }
};
