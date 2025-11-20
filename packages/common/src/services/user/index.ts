import { and, db, eq, sql } from '@op/db/client';
import {
  EntityType,
  allowList,
  organizationUsers,
  organizations,
  profiles,
  users,
  usersUsedStorage,
} from '@op/db/schema';
import { type UserWithRoles, getGlobalPermissions } from 'access-zones';

import { getNormalizedRoles } from '../access';
import { generateUniqueProfileSlug } from '../profile/utils';
import { AllowListUser, allowListMetadataSchema } from './validators';

export interface User {
  id: number;
  email: string;
}

export const createUserByEmail = async ({
  email,
  authUserId,
}: {
  authUserId: string;
  email: string;
}): Promise<void> => {
  try {
    // Use INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING to atomically
    // get or create the user in a single query
    const [user] = await db
      .insert(users)
      .values({ authUserId, email })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          authUserId, // Update authUserId in case it changed in Supabase Auth
          updatedAt: sql`now()`,
        },
      })
      .returning();

    if (!user) {
      throw new Error('Failed to create or retrieve user');
    }

    // If user already has a profile, we're done
    if (user.profileId) {
      return;
    }

    // Create profile and link it to user atomically
    // Use a transaction to ensure profile creation and user update succeed together
    await db.transaction(async (tx) => {
      // Double-check profileId inside transaction to prevent race condition
      const [existingUser] = await tx
        .select({ profileId: users.profileId })
        .from(users)
        .where(eq(users.authUserId, authUserId))
        .for('update'); // Lock the row to prevent concurrent modifications
      if (existingUser?.profileId) {
        // Another request already created the profile
        return;
      }

      // Create the profile
      const [newProfile] = await tx
        .insert(profiles)
        .values({
          type: EntityType.INDIVIDUAL,
          name: user.name || email.split('@')[0] || 'User',
          slug: await generateUniqueProfileSlug({
            name: user.name || email.split('@')[0] || 'User',
            db: tx,
          }),
        })
        .returning();

      if (!newProfile) {
        throw new Error('Failed to create user profile');
      }

      // Link the profile to the user
      await tx
        .update(users)
        .set({
          profileId: newProfile.id,
          currentProfileId: newProfile.id,
        })
        .where(eq(users.authUserId, authUserId));
    });
  } catch (e) {
    console.error(e);
    throw new Error('Something went wrong. Please try again.');
  }
};

/**
 * Fetch an allow list entry by email. Limited to 1, so use as prsensence check.
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
    where: (table, { eq }) => eq(table.authUserId, authUserId),
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

        // Transform the relational data into normalized format for access-zones library
        const normalizedRoles = getNormalizedRoles(orgUser.roles);

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
    where: (table, { eq }) => eq(table.authUserId, authUserId),
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
    where: (table, { eq }) => eq(table.authUserId, authUserId),
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
  orgId?: number;
}

export const updateUserCurrentProfile = async (
  options: UpdateUserCurrentProfileOptions,
) => {
  const { authUserId, profileId, orgId } = options;
  return await db
    .update(users)
    .set({
      currentProfileId: profileId,
      ...(orgId
        ? { lastOrgId: orgId.toString() }
        : {
            lastOrgId: null,
          }),
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
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
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
    throw new Error('User not found');
  }

  return result[0];
};
