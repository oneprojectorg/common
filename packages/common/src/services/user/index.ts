import { and, db, eq, sql } from '@op/db/client';
import {
  allowList,
  organizationUsers,
  users,
  usersUsedStorage,
} from '@op/db/schema';
import { type UserWithRoles, getGlobalPermissions } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils/error';
import { getNormalizedRoles, getOrgAccessUser } from '../access';
import type { RoleJunction } from '../access/utils';
import { AllowListUser, allowListMetadataSchema } from './validators';

export interface User {
  id: number;
  email: string;
}

/**
 * Fetch an allow list entry by email.
 */
export const getAllowListUser = async ({
  email,
}: {
  email?: string;
}): Promise<AllowListUser | undefined> => {
  if (!email) {
    return;
  }

  const [allowedResult] = await db
    .select({
      email: allowList.email,
      organizationId: allowList.organizationId,
      metadata: allowList.metadata,
    })
    .from(allowList)
    .where(eq(allowList.email, email.toLowerCase()))
    .limit(1);

  if (!allowedResult) {
    return;
  }

  // Extract role from allowListUser metadata if present
  const metadata = allowListMetadataSchema.safeParse(
    allowedResult.metadata ?? {},
  );

  return {
    ...allowedResult,
    metadata: metadata.success ? metadata.data : null,
  };
};

export const getUserByAuthId = async ({
  authUserId,
  includePermissions = false,
}: {
  authUserId: string;
  includePermissions?: boolean;
}) => {
  const user = await db.query.users.findFirst({
    where: { authUserId },
    with: {
      avatarImage: true,
      organizationUsers: {
        with: {
          organization: {
            with: {
              profile: {
                with: {
                  avatarImage: true,
                },
              },
            },
          },
          roles: includePermissions
            ? {
                with: {
                  accessRole: {
                    with: {
                      zonePermissions: {
                        with: {
                          accessZone: true,
                        },
                      },
                    },
                  },
                },
              }
            : undefined,
        },
      },
      profileUsers: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
          roles: includePermissions
            ? {
                with: {
                  accessRole: {
                    with: {
                      zonePermissions: {
                        with: {
                          accessZone: true,
                        },
                      },
                    },
                  },
                },
              }
            : undefined,
        },
      },
      currentOrganization: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
      currentProfile: {
        with: {
          avatarImage: true,
          headerImage: true,
          individual: { columns: { pronouns: true } },
        },
      },
      profile: {
        with: {
          avatarImage: true,
          headerImage: true,
          individual: { columns: { pronouns: true } },
        },
      },
    },
  });

  if (!user || !includePermissions) {
    return user;
  }

  // Process each organizationUser to add permissions
  const userWithPermissions = { ...user };

  if (userWithPermissions.organizationUsers) {
    userWithPermissions.organizationUsers =
      userWithPermissions.organizationUsers.map((orgUser) => {
        if (!orgUser.roles) {
          return orgUser;
        }

        // Transform the relational data into normalized format for access-zones library.
        // The role-with-accessRole shape is only present when includePermissions=true.
        const normalizedRoles = getNormalizedRoles(
          orgUser.roles as Array<Pick<RoleJunction, 'accessRole'>>,
        );

        // Transform the user to the format expected by access-zones
        const userForTransformation: UserWithRoles = {
          id: orgUser.id,
          roles: normalizedRoles,
        };

        // Get the global boolean permissions
        const globalPermissions = getGlobalPermissions(userForTransformation);

        // Return orgUser with permissions attached
        return {
          ...orgUser,
          permissions: globalPermissions,
        };
      });
  }

  if (userWithPermissions.profileUsers) {
    userWithPermissions.profileUsers = userWithPermissions.profileUsers.map(
      (profileUser) => {
        if (!profileUser.roles) {
          return profileUser;
        }

        const normalizedRoles = getNormalizedRoles(
          profileUser.roles as Array<Pick<RoleJunction, 'accessRole'>>,
        );

        const userForTransformation: UserWithRoles = {
          id: profileUser.id,
          roles: normalizedRoles,
        };

        const globalPermissions = getGlobalPermissions(userForTransformation);

        return {
          ...profileUser,
          permissions: globalPermissions,
        };
      },
    );
  }

  return userWithPermissions;
};

export const createUserByAuthId = async ({
  authUserId,
  email,
}: {
  authUserId: string;
  email: string;
}) => {
  const [newUser] = await db
    .insert(users)
    .values({
      authUserId,
      email,
    })
    .returning();

  if (!newUser) {
    throw new Error('Could not create user');
  }

  return await getUserByAuthId({ authUserId, includePermissions: false });
};

export const getUserWithProfiles = async ({
  authUserId,
  includeRoles = false,
}: {
  authUserId: string;
  includeRoles?: boolean;
}) => {
  return await db.query.users.findFirst({
    where: { authUserId },
    with: {
      profile: {
        with: {
          avatarImage: true,
        },
      },
      organizationUsers: {
        with: {
          organization: {
            with: {
              profile: {
                with: {
                  avatarImage: true,
                },
              },
            },
          },
          roles: includeRoles
            ? {
                with: {
                  accessRole: true,
                },
              }
            : undefined,
        },
      },
    },
  });
};

export const getUserForProfileSwitch = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
  return await db.query.users.findFirst({
    where: { authUserId },
    with: {
      profile: true,
      organizationUsers: {
        with: {
          organization: {
            with: {
              profile: true,
            },
          },
          roles: {
            with: {
              accessRole: {
                with: {
                  zonePermissions: {
                    with: {
                      accessZone: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
};

export interface UpdateUserCurrentProfileOptions {
  authUserId: string;
  profileId: string;
  orgId?: string;
}

export const updateUserCurrentProfile = async (
  options: UpdateUserCurrentProfileOptions,
) => {
  const { authUserId, profileId, orgId } = options;
  return await db
    .update(users)
    .set({
      currentProfileId: profileId,
      lastOrgId: orgId ?? null,
    })
    .where(eq(users.authUserId, authUserId))
    .returning();
};

export const checkUsernameAvailability = async ({
  username,
}: {
  username: string;
}) => {
  if (username === '') {
    return { available: true };
  }

  const result = await db
    .select({
      exists: sql<boolean>`true`,
    })
    .from(organizationUsers)
    .where(eq(users.username, username))
    .limit(1);

  if (!result.length || !result[0]) {
    return { available: true };
  }

  return { available: false };
};

export const getUserStorageUsage = async ({ userId }: { userId: string }) => {
  const result = await db
    .select()
    .from(usersUsedStorage)
    .where(and(eq(usersUsedStorage.userId, userId)))
    .limit(1);

  if (!result.length || !result[0]) {
    return {
      usedStorage: 0,
      maxStorage: 4000000000 as const,
    };
  }

  return {
    usedStorage: Number.parseInt(result[0].totalSize as string),
    maxStorage: 4000000000 as const,
  };
};

export interface SwitchUserOrganizationOptions {
  authUserId: string;
  organizationId: string;
}

export const switchUserOrganization = async (
  options: SwitchUserOrganizationOptions,
) => {
  const { authUserId, organizationId } = options;
  // First, get the organization to find its profile ID
  const organization = await db.query.organizations.findFirst({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new NotFoundError('Organization', organizationId);
  }

  const orgUser = await getOrgAccessUser({
    user: { id: authUserId },
    organizationId,
  });

  if (!orgUser) {
    throw new UnauthorizedError('Not a member of this organization');
  }

  const result = await db
    .update(users)
    .set({
      lastOrgId: organization.id,
      currentProfileId: organization.profileId,
    })
    .where(eq(users.authUserId, authUserId))
    .returning();

  if (!result.length || !result[0]) {
    throw new NotFoundError('User');
  }

  return result[0];
};

export const completeOnboarding = async ({
  authUserId,
  tos,
  privacy,
}: {
  authUserId: string;
  tos: boolean;
  privacy: boolean;
}) => {
  await db
    .update(users)
    .set({
      onboardedAt: new Date().toISOString(),
      tos,
      privacy,
    })
    .where(eq(users.authUserId, authUserId));
};
