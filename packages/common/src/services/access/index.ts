import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { and, db, eq } from '@op/db/client';
import { organizations, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createServerClient } from '@op/supabase/lib';
import type { NormalizedRole } from 'access-zones';
import { cookies } from 'next/headers';

import { UnauthorizedError } from '../../utils/error';

type OrgUserWithNormalizedRoles = {
  id: string;
  authUserId: string;
  name: string | null;
  email: string;
  about: string | null;
  organizationId: string;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  deletedAt?: string | Date | null;
  roles: NormalizedRole[];
};

// gets a user assuming that the user is authenticated
export const getOrgAccessUser = async ({
  user,
  organizationId,
}: {
  user: User;
  organizationId: string;
}): Promise<OrgUserWithNormalizedRoles | undefined> => {
  const orgUser = await db.query.organizationUsers.findFirst({
    where: (table, { eq }) =>
      and(
        eq(table.organizationId, organizationId),
        eq(table.authUserId, user.id),
      ),
    with: {
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
  });

  if (orgUser) {
    // Transform the relational data into normalized format for access-zones library
    const normalizedRoles: NormalizedRole[] = orgUser.roles.map(
      (roleJunction) => {
        const role = roleJunction.accessRole;

        // Build the access object with zone names as keys and permission bitfields as values
        const access: Record<string, number> = {};

        if (role.zonePermissions) {
          role.zonePermissions.forEach((zonePermission: any) => {
            // Use zone name as key, permission bitfield as value
            access[zonePermission.accessZone.name] = zonePermission.permission;
          });
        }

        return {
          id: role.id,
          name: role.name,
          access,
        };
      },
    );

    // Replace roles with normalized format
    return {
      ...orgUser,
      roles: normalizedRoles,
    } as OrgUserWithNormalizedRoles;
  }

  return orgUser as OrgUserWithNormalizedRoles | undefined;
};

const useUrl = OPURLConfig('APP');
const createClient = async () => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions:
        useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW
          ? {
              domain: cookieOptionsDomain,
              sameSite: 'lax',
              secure: true,
            }
          : {},
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            cookieStore.set({ name, value }),
          );
        },
      },
    },
  );

  return supabase;
};

export const getSession = async () => {
  const supabase = await createClient();

  const sessionUser = await supabase.auth.getUser();
  const {
    data: { user },
  } = sessionUser;

  if (!user) {
    return null;
  }

  try {
    const dbUser = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.authUserId, user?.id),
      with: {
        organizationUsers: true,
      },
    });

    if (!dbUser) {
      return null;
    }

    // Backwards compatibility: migrate lastOrgId to currentProfileId if needed
    if (dbUser.lastOrgId && !dbUser.currentProfileId) {
      try {
        const [org] = await db
          .select({ profileId: organizations.profileId })
          .from(organizations)
          .where(eq(organizations.id, dbUser.lastOrgId))
          .limit(1);

        if (org) {
          // Update the user with the profile ID
          await db
            .update(users)
            .set({ currentProfileId: org.profileId })
            .where(eq(users.authUserId, user.id));

          // Return the updated user object
          return { user: { ...dbUser, currentProfileId: org.profileId } };
        }
      } catch (migrationError) {
        console.error('Migration error:', migrationError);
        // Continue with the original user object if migration fails
      }
    }

    return { user: dbUser };
  } catch (error) {
    console.error('ERROR');
    return null;
  }
};

export const getCurrentProfileId = async () => {
  const { user } = (await getSession()) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Primary: use currentProfileId if available
  if (user.currentProfileId) {
    return user.currentProfileId;
  }

  // Fallback: if lastOrgId exists but currentProfileId doesn't, convert it
  if (user.lastOrgId) {
    try {
      const [org] = await db
        .select({ profileId: organizations.profileId })
        .from(organizations)
        .where(eq(organizations.id, user.lastOrgId))
        .limit(1);

      if (org) {
        return org.profileId;
      }
    } catch (error) {
      console.error('Error converting lastOrgId to profileId:', error);
    }
  }

  throw new UnauthorizedError("You don't have access to do this");
};

export const getCurrentOrgId = async ({
  database,
}: {
  database: typeof db;
}) => {
  const { user } = (await getSession()) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Primary: use currentProfileId if available
  if (user.currentProfileId) {
    const [org] = await database
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.profileId, user.currentProfileId))
      .limit(1);

    if (org) {
      return org.id;
    }
  }

  // Fallback: use lastOrgId directly if currentProfileId doesn't work
  if (user.lastOrgId) {
    return user.lastOrgId;
  }

  throw new UnauthorizedError("You don't have access to do this");
};

export const getCurrentOrgUserId = async (organizationId: string) => {
  const session = await getSession();

  if (!session?.user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const orgUser = await getOrgAccessUser({
    user: { id: session.user.authUserId } as User,
    organizationId,
  });

  if (!orgUser) {
    throw new UnauthorizedError("You don't have access to this organization");
  }

  return orgUser.id;
};

// NEW PARAMETER-BASED FUNCTIONS (will replace the above functions during migration)

/**
 * Gets user session data by authUserId (database-only, no Supabase auth)
 */
export const getUserSession = async ({ authUserId }: { authUserId: string }) => {
  try {
    const dbUser = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.authUserId, authUserId),
      with: {
        organizationUsers: true,
      },
    });

    if (!dbUser) {
      return null;
    }

    // Backwards compatibility: migrate lastOrgId to currentProfileId if needed
    if (dbUser.lastOrgId && !dbUser.currentProfileId) {
      try {
        const [org] = await db
          .select({ profileId: organizations.profileId })
          .from(organizations)
          .where(eq(organizations.id, dbUser.lastOrgId))
          .limit(1);

        if (org) {
          // Update the user with the profile ID
          await db
            .update(users)
            .set({ currentProfileId: org.profileId })
            .where(eq(users.authUserId, authUserId));

          // Return the updated user object
          return { user: { ...dbUser, currentProfileId: org.profileId } };
        }
      } catch (migrationError) {
        console.error('Migration error:', migrationError);
        // Continue with the original user object if migration fails
      }
    }

    return { user: dbUser };
  } catch (error) {
    console.error('ERROR');
    return null;
  }
};

/**
 * Gets current profile ID by authUserId (database-only, no Supabase auth)
 */
export const getCurrentProfileIdByAuth = async ({ authUserId }: { authUserId: string }) => {
  const { user } = (await getUserSession({ authUserId })) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Primary: use currentProfileId if available
  if (user.currentProfileId) {
    return user.currentProfileId;
  }

  // Fallback: if lastOrgId exists but currentProfileId doesn't, convert it
  if (user.lastOrgId) {
    try {
      const [org] = await db
        .select({ profileId: organizations.profileId })
        .from(organizations)
        .where(eq(organizations.id, user.lastOrgId))
        .limit(1);

      if (org) {
        return org.profileId;
      }
    } catch (error) {
      console.error('Error converting lastOrgId to profileId:', error);
    }
  }

  throw new UnauthorizedError("You don't have access to do this");
};

/**
 * Gets current organization ID by authUserId (database-only, no Supabase auth)
 */
export const getCurrentOrgIdByAuth = async ({
  authUserId,
  database,
}: {
  authUserId: string;
  database: typeof db;
}) => {
  const { user } = (await getUserSession({ authUserId })) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Primary: use currentProfileId if available
  if (user.currentProfileId) {
    const [org] = await database
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.profileId, user.currentProfileId))
      .limit(1);

    if (org) {
      return org.id;
    }
  }

  // Fallback: use lastOrgId directly if currentProfileId doesn't work
  if (user.lastOrgId) {
    return user.lastOrgId;
  }

  throw new UnauthorizedError("You don't have access to do this");
};

/**
 * Gets current organization user ID by authUserId (database-only, no Supabase auth)
 */
export const getCurrentOrgUserIdByAuth = async ({
  authUserId,
  organizationId,
}: {
  authUserId: string;
  organizationId: string;
}) => {
  const session = await getUserSession({ authUserId });

  if (!session?.user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const orgUser = await getOrgAccessUser({
    user: { id: session.user.authUserId } as User,
    organizationId,
  });

  if (!orgUser) {
    throw new UnauthorizedError("You don't have access to this organization");
  }

  return orgUser.id;
};

export * from './getRoles';
