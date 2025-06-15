import { db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { User } from '@op/supabase/lib';

export const matchingDomainOrganizations = async ({ user }: { user: User }) => {
  if (!user?.email) {
    return [];
  }

  // Extract domain from user's email address
  const emailDomain = user.email.split('@')[1];

  if (!emailDomain) {
    return [];
  }

  const results = await db.query.organizations.findMany({
    where: eq(organizations.domain, emailDomain),
    with: {
      profile: {
        with: {
          avatarImage: true,
        },
      },
    },
  });

  return results;
};
