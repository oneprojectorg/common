import { cache } from '@op/cache';
import { and, db, eq } from '@op/db/client';
import { organizations, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { NormalizedRole } from 'access-zones';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils/error';
import { getNormalizedRoles } from './utils';

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
  user: { id: string };
  organizationId: string;
}): Promise<OrgUserWithNormalizedRoles | undefined> => {
  const getOrgUser = async () => {
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
      // Type assertion needed because Drizzle query result type is complex but we know it has the right structure
      const normalizedRoles = getNormalizedRoles(
        orgUser.roles as Array<{ accessRole: any }>,
      );

      // Replace roles with normalized format
      return {
        ...orgUser,
        roles: normalizedRoles,
      } as OrgUserWithNormalizedRoles;
    }

    return orgUser as OrgUserWithNormalizedRoles | undefined;
  };

  return cache({
    type: 'orgUser',
    params: [organizationId, user.id],
    fetch: getOrgUser,
    options: {
      skipMemCache: true,
    },
  });
};

export const getCurrentProfileId = async (authUserId: string) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const { user } =
    (await getUserSession({ authUserId: validatedAuthUserId })) ?? {};

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

export const getIndividualProfileId = async (authUserId: string) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const { user } =
    (await getUserSession({ authUserId: validatedAuthUserId })) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Use the user's individual profileId (not currentProfileId)
  if (user.profileId) {
    return user.profileId;
  }

  throw new UnauthorizedError("You don't have an individual profile");
};

export const getCurrentOrgId = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const { user } =
    (await getUserSession({ authUserId: validatedAuthUserId })) ?? {};

  if (!user) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // Primary: use currentProfileId if available
  if (user.currentProfileId) {
    const [org] = await db
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

export const getCurrentOrgUserId = async (
  organizationId: string,
  authUserId: string,
) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);
  const session = await getUserSession({ authUserId: validatedAuthUserId });

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

// UTILITY FUNCTIONS FOR AUTH VALIDATION

const authUserIdSchema = z.uuid('Invalid authentication user ID format');

export const validateAuthUserId = (authUserId: string | undefined) => {
  if (!authUserId) {
    throw new UnauthorizedError('Authentication required');
  }

  try {
    return authUserIdSchema.parse(authUserId);
  } catch {
    throw new UnauthorizedError('Invalid authentication credentials');
  }
};

/**
 * Gets user session data by authUserId (database-only, no Supabase auth)
 * Used internally
 */
export const getUserSession = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
  const validatedAuthUserId = validateAuthUserId(authUserId);

  try {
    const dbUser = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.authUserId, validatedAuthUserId),
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
            .where(eq(users.authUserId, validatedAuthUserId));

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

export * from './getRoles';
export * from './utils';
