import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { and, db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createServerClient } from '@op/supabase/lib';
import { cookies } from 'next/headers';

import { NotFoundError, UnauthorizedError } from '../../utils/error';

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

    return { user: dbUser };
  } catch (error) {
    console.error('ERROR');
    return null;
  }
};

export const getCurrentProfileId = async ({
  database,
}: {
  database: typeof db;
}) => {
  const { user } = (await getSession()) ?? {};

  if (!user || !user.lastOrgId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  const [sourceOrg] = await database
    .select({ profileId: organizations.profileId })
    .from(organizations)
    .where(eq(organizations.id, user.lastOrgId))
    .limit(1);

  if (!sourceOrg) {
    throw new NotFoundError('Organization not found');
  }

  return sourceOrg.profileId;
};
