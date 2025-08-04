import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { and, db, eq } from '@op/db/client';
import { organizations, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createServerClient } from '@op/supabase/lib';
import { cookies } from 'next/headers';

import { UnauthorizedError } from '../../utils/error';

// gets a user assuming that the user is authenticated
export const getOrgAccessUser = async ({
  user,
  organizationId,
}: {
  user: User;
  organizationId: string;
}) => {
  const orgUser = await db.query.organizationUsers.findFirst({
    where: (table, { eq }) =>
      and(
        eq(table.organizationId, organizationId),
        eq(table.authUserId, user.id),
      ),
    with: { roles: true },
  });

  return orgUser;
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
