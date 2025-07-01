import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { and, db } from '@op/db/client';
import { AccessRole, OrganizationUser } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createServerClient } from '@op/supabase/lib';
import { cookies } from 'next/headers';

// gets a user assuming that the user is authenticated
export const getOrgAccessUser = async ({
  user,
  organizationId,
}: {
  user: User;
  organizationId: string;
}) => {
  const orgUser = (await db.query.organizationUsers.findFirst({
    where: (table, { eq }) =>
      and(
        eq(table.organizationId, organizationId),
        eq(table.authUserId, user.id),
      ),
  })) as OrganizationUser & { roles: Array<AccessRole> };

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

export const getSession = async (): Promise<{ user: any } | null> => {
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

    return { user: dbUser };
  } catch (error) {
    console.error('ERROR');
    return null;
  }
};
