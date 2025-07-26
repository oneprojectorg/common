import { db, eq } from '@op/db/client';
import { allowList, users } from '@op/db/schema';

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

export const getUserByAuthId = async (authUserId: string) => {
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

export const createUserByAuthId = async ({ authUserId, email }: { authUserId: string; email: string }) => {
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

export const getUserWithProfiles = async (authUserId: string) => {
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

export const getUserForProfileSwitch = async (authUserId: string) => {
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

export const updateUserCurrentProfile = async (authUserId: string, profileId: string, orgId?: number) => {
  return await db
    .update(users)
    .set({
      currentProfileId: profileId,
      ...(orgId ? { lastOrgId: orgId.toString() } : {}),
    })
    .where(eq(users.authUserId, authUserId))
    .returning();
};