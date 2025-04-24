import {
  links,
  Organization,
  organizations,
  organizationUsers,
} from '@op/db/schema';
import { CommonError, UnauthorizedError } from '../../utils';
import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

export const getOrganization = async ({
  slug,
  id,
  user,
}: { user: User } & (
  | { id: string; slug?: undefined }
  | { id?: undefined; slug: string }
)) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  if (!slug && !id) {
    return;
  }

  // assertAccess({ organization, permission: 'read' }, user.roles);

  const result = await db.query.organizations.findFirst({
    where: slug
      ? (table, { eq }) => eq(table.slug, slug)
      : (table, { eq }) => eq(table.id, id!),
    with: {
      projects: true,
      links: true,
      headerImage: true,
      avatarImage: true,
    },
  });

  return result;
};

export const createOrganization = async ({
  data,
  user,
}: {
  data: Partial<Organization>;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  // assertAccess({ organization, permission: 'create' }, user.roles);

  const newOrg = await db.insert(organizations).values(data).returning();

  return newOrg;
};

export const createOrganizationWithUser = async ({
  data,
  user,
}: {
  data: Partial<Organization>;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  // Create organization and link user in a single transaction
  const result = await db.transaction(async (tx) => {
    // Insert organization record
    const newOrg = await tx
      .insert(organizations)
      .values({
        email: user.email,
        slug: randomUUID(),
        name: data.organizationName,
        isOfferingFunds: data.isOfferingFunds,
        isReceivingFunds: data.isReceivingFunds,
        website: data.website,
        mission: data.mission,
        values: data.values,
      })
      .returning();
    if (!newOrg || newOrg.length === 0) {
      throw new CommonError('Failed to create organization');
    }

    // Insert organizationUser linking the user to organization, with a default role of owner
    const newOrgUser = await tx
      .insert(organizationUsers)
      .values({
        organizationId: newOrg[0].id,
        authUserId: user.id,
        email: user.email,
      })
      .returning();

    // Add funding links
    const receivingFundsLink = data.receivingFundsLink
      ? await tx.insert(links).values({
          organizationId: newOrg[0].id,
          href: data.receivingFundsLink,
          type: 'receiving',
        })
      : undefined;
    const offeringFundsLink = data.offeringFundsLink
      ? await tx.insert(links).values({
          organizationId: newOrg[0].id,
          href: data.offeringFundsLink,
          type: 'offering',
        })
      : undefined;

    if (!newOrgUser || newOrgUser.length === 0) {
      throw new CommonError('Failed to associate organization with user');
    }

    return newOrg[0];
  });

  return result;
};
