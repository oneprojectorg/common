import { OPURLConfig } from '@op/core';
import { and, db, eq, inArray, or } from '@op/db/client';
import {
  Organization,
  Profile,
  accessRoles,
  organizationRelationships,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { relationshipMap } from '@op/types';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { sendRelationshipRequestEmail } from '../email';

type OrganizationWithProfile = Organization & {
  profile: Profile & { avatarImage: any };
};

const invertRelationship = <T, C>(
  relationship: {
    sourceOrganizationId: string;
    sourceOrganization: C;
    targetOrganizationId: string;
    targetOrganization: C;
    relationshipType: string;
  } & T,
) => ({
  ...relationship,
  // swap the relationship
  sourceOrganizationId: relationship.targetOrganizationId,
  sourceOrganization: relationship.targetOrganization,
  targetOrganizationId: relationship.sourceOrganizationId,
  targetOrganization: relationship.sourceOrganization,

  relationshipType:
    relationshipMap[relationship.relationshipType]?.inverse ??
    relationship.relationshipType,
});

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

export const sendRelationshipNotification = async ({
  to,
  from,
  relationships,
}: {
  from: string;
  to: string;
  relationships: Array<string>;
}) => {
  const [sourceOrg, targetOrg] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, from),
      with: { profile: true },
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, to),
      with: { profile: true },
    }),
  ]);

  if (!sourceOrg || !targetOrg) {
    throw new NotFoundError('Organization not found');
  }

  // Send email notifications to target organization admin users only
  try {
    const adminUsers = await db.query.organizationUsers.findMany({
      where: and(
        eq(organizationUsers.organizationId, to),
        inArray(
          organizationUsers.id,
          db
            .select({
              userId: organizationUserToAccessRoles.organizationUserId,
            })
            .from(organizationUserToAccessRoles)
            .leftJoin(
              accessRoles,
              eq(organizationUserToAccessRoles.accessRoleId, accessRoles.id),
            )
            .where(eq(accessRoles.name, 'Admin')),
        ),
      ),
    });

    const appUrlConfig = OPURLConfig('APP');

    // Don't send emails to external users in staging/dev since lots of random fake (maybe real) emails are used that we don't intend to be sent to
    await Promise.all(
      adminUsers.map((adminUser) => {
        // if (
        // !appUrlConfig.IS_PRODUCTION &&
        // !adminUser.email.endsWith('oneproject.org')
        // ) {
        // console.log(
        // 'Skipping send of external relationship email in staging/development',
        // adminUser.email,
        // );
        // return;
        // }

        sendRelationshipRequestEmail({
          to: adminUser.email,
          requesterOrgName:
            (sourceOrg.profile as any)?.name || 'Unknown Organization',
          targetOrgName:
            (targetOrg.profile as any)?.name || 'Unknown Organization',
          relationshipTypes: relationships,
          approvalUrl: appUrlConfig.ENV_URL,
        });
      }),
    );
  } catch (emailError) {
    console.error('Failed to send relationship request emails:', emailError);
  }
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
    const isInverseRelationship = relationship.sourceOrganizationId === orgId;
    const relatedOrg = (
      isInverseRelationship
        ? relationship.targetOrganization
        : relationship.sourceOrganization
    ) as OrganizationWithProfile;

    if (!distinctRelationships.has(relatedOrg.id)) {
      distinctRelationships.set(relatedOrg.id, relatedOrg);
    }

    const org = distinctRelationships.get(relatedOrg.id);
    // make sure that the relationship is inverted if we found an edge that is in the opposite direction from the one we are looking for
    const relationshipRecord = {
      relationshipType: isInverseRelationship
        ? (relationshipMap[relationship.relationshipType]?.inverse ??
          'Affiliation')
        : relationship.relationshipType,
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
  const redirectedInverseRelationships = inverseRelationships.map(
    (relationship) =>
      invertRelationship<
        typeof relationship,
        (typeof relationship)['sourceOrganization']
      >(relationship),
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
        id: string;
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
      id: relationship.id,
      relationshipType:
        relationshipMap[relationship.relationshipType]?.inverse ??
        relationship.relationshipType,
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
  ids,
  user,
}: {
  user: User;
  targetOrganizationId: string;
  ids: string[];
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
      .where(inArray(organizationRelationships.id, ids));

    return true;
  } catch (e) {
    throw new CommonError('Could not decline relationship');
  }
};
