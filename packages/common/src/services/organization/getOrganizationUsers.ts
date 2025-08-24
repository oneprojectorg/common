import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export const getOrganizationUsers = async ({
  profileId,
  user,
}: {
  profileId: string;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  // First, find the organization by profileId
  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.profileId, profileId),
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  const organizationId = organization.id;

  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ admin: permission.READ }, orgUser?.roles || []);

  // Fetch all users in the organization with their roles
  const organizationUsers = await db.query.organizationUsers.findMany({
    where: (table, { eq }) => eq(table.organizationId, organizationId),
    with: {
      roles: {
        with: {
          accessRole: true,
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.name), asc(table.email)],
  });

  // Transform the data to include role names
  return organizationUsers.map((orgUser) => ({
    id: orgUser.id,
    authUserId: orgUser.authUserId,
    name: orgUser.name,
    email: orgUser.email,
    about: orgUser.about,
    organizationId: orgUser.organizationId,
    createdAt: orgUser.createdAt,
    updatedAt: orgUser.updatedAt,
    roles: orgUser.roles.map((roleJunction) => ({
      id: roleJunction.accessRole.id,
      name: roleJunction.accessRole.name,
      description: roleJunction.accessRole.description,
    })),
  }));
};
