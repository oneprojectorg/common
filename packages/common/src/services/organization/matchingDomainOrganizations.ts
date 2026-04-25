import { db } from '@op/db/client';
import { organizationUsers } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

export const matchingDomainOrganizations = async ({ user }: { user: User }) => {
  if (!user?.email) {
    return [];
  }

  const emailDomain = user.email.split('@')[1];

  if (!emailDomain) {
    return [];
  }

  const [rawResults, preMappedOrgs, membershipRows] = await Promise.all([
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
    // Skip orgs the user is already a member of so onboarding doesn't
    // pre-select an org and then dispatch a join request that would fail.
    db
      .select({ organizationId: organizationUsers.organizationId })
      .from(organizationUsers)
      .where(eq(organizationUsers.authUserId, user.id)),
  ]);

  const excludedOrgIds = new Set(
    membershipRows.map((row) => row.organizationId),
  );

  const transformOrg = (org: (typeof rawResults)[number]) => ({
    ...org,
    whereWeWork: org.whereWeWork.map((item) => item.location),
  });

  const results = rawResults
    .filter((org) => !excludedOrgIds.has(org.id))
    .map(transformOrg);

  for (const preMappedOrg of preMappedOrgs) {
    const { organization } = preMappedOrg;
    if (
      organization &&
      !excludedOrgIds.has(organization.id) &&
      !results.find((r) => r.id === organization.id)
    ) {
      results.push(transformOrg(organization));
    }
  }

  return results;
};
