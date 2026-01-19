import { db, eq } from '@op/db/client';
import { Organization, Profile, allowList, organizations } from '@op/db/schema';
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

  try {
    const [results, preMappedOrgs] = await Promise.all([
      db._query.organizations.findMany({
        where: eq(organizations.domain, emailDomain.toLowerCase()),
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      }),
      db._query.allowList.findMany({
        where: eq(allowList.email, user.email.toLowerCase()),
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
      }),
    ]);

    if (preMappedOrgs.length > 0) {
      preMappedOrgs.forEach((preMappedOrg) => {
        const org = preMappedOrg?.organization as unknown as Organization & {
          profile: Profile;
        };

        if (org && !results.find((r) => r.id === org.id)) {
          results.push(org);
        }
      });
    }

    return results;
  } catch (e) {
    console.log(e);
    throw e;
  }
};
