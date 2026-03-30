import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';

export const matchingDomainOrganizations = async ({ user }: { user: User }) => {
  if (!user?.email) {
    return [];
  }

  const emailDomain = user.email.split('@')[1];

  if (!emailDomain) {
    return [];
  }

  const [rawResults, preMappedOrgs] = await Promise.all([
    db.query.organizations.findMany({
      where: { domain: emailDomain.toLowerCase() },
      with: {
        profile: {
          with: {
            avatarImage: true,
          },
        },
        whereWeWork: {
          with: {
            location: true,
          },
        },
      },
    }),
    db.query.allowList.findMany({
      where: { email: user.email.toLowerCase() },
      with: {
        organization: {
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
            whereWeWork: {
              with: {
                location: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const transformOrg = (org: (typeof rawResults)[number]) => ({
    ...org,
    whereWeWork: org.whereWeWork.map((item) => item.location),
  });

  const results = rawResults.map(transformOrg);

  if (preMappedOrgs.length > 0) {
    for (const preMappedOrg of preMappedOrgs) {
      const rawOrg = preMappedOrg?.organization as unknown as
        | (typeof rawResults)[number]
        | undefined;
      if (rawOrg && !results.find((r) => r.id === rawOrg.id)) {
        results.push(transformOrg(rawOrg));
      }
    }
  }

  return results;
};
