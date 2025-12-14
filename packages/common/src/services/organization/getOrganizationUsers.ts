import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { assertOrganization } from '../assert';

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
  const organization = await assertOrganization({ profileId });

  const orgUser = await getOrgAccessUser({
    user,
    organizationId: organization.id,
  });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ admin: permission.READ }, orgUser?.roles || []);

  // Fetch all users in the organization with their roles and avatar images
  const organizationUsers = await db.query.organizationUsers.findMany({
    where: (table, { eq }) => eq(table.organizationId, organization.id),
    with: {
      roles: {
        with: {
          accessRole: true,
        },
      },
      serviceUser: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.name), asc(table.email)],
  });

  // Transform the data to include role names and user profile data
  return organizationUsers.map((orgUser) => {
    const serviceUser = orgUser.serviceUser as any;
    const userProfile = serviceUser?.profile;

    return {
      id: orgUser.id,
      authUserId: orgUser.authUserId,
      // Use organization user data as fallback, but prefer profile data
      name: userProfile?.name || orgUser.name,
      email: orgUser.email,
      about: userProfile?.bio || orgUser.about,
      organizationId: orgUser.organizationId,
      createdAt: orgUser.createdAt,
      updatedAt: orgUser.updatedAt,
      // Include profile data for avatar and other profile info
      profile: userProfile
        ? {
            id: userProfile.id,
            name: userProfile.name,
            slug: userProfile.slug,
            bio: userProfile.bio,
            email: userProfile.email,
            type: userProfile.type,
            avatarImage: userProfile.avatarImage
              ? {
                  id: userProfile.avatarImage.id,
                  name: userProfile.avatarImage.name,
                }
              : null,
          }
        : null,
      roles: orgUser.roles.map((roleJunction) => ({
        id: roleJunction.accessRole.id,
        name: roleJunction.accessRole.name,
        description: roleJunction.accessRole.description,
      })),
    };
  });
};
