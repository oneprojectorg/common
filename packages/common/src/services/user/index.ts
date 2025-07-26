import { and, db, eq, sql } from '@op/db/client';
import {
  allowList,
  organizationUsers,
  organizations,
  users,
  usersUsedStorage,
} from '@op/db/schema';

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
    // Attempt to insert a new user; on conflict (duplicate email) do nothing
    const newUser = await db
      .insert(users)
      .values({ authUserId, email })
      .onConflictDoNothing()
      .returning();

    // If insertion was successful, return
    if (newUser.length > 0) {
      return;
    }

    // Otherwise, fetch the existing user by email
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return;
    }
  } catch (e) {
    console.error(e);
    throw new Error('Something went wrong. Please try again.');
  }
};

export const getAllowListUser = async ({ email }: { email?: string }) => {
  if (!email) {
    return;
  }

  const [allowedEmail] = await db
    .select({
      email: allowList.email,
      organizationId: allowList.organizationId,
    })
    .from(allowList)
    .where(eq(allowList.email, email.toLowerCase()))
    .limit(1);

  return allowedEmail;
};

export const getUserByAuthId = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
  return await db.query.users.findFirst({
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
        },
      },
      profile: {
        with: {
          avatarImage: true,
          headerImage: true,
        },
      },
    },
  });
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

  return await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.id, newUser.id),
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
        },
      },
      profile: {
        with: {
          avatarImage: true,
          headerImage: true,
        },
      },
    },
  });
};

export const getUserWithProfiles = async ({
  authUserId,
}: {
  authUserId: string;
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
      ...(orgId ? { lastOrgId: orgId.toString() } : {}),
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
