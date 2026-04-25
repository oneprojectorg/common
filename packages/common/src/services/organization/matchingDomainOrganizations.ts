import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';

export const matchingDomainOrganizations = async ({ user }: { user: User }) => {
  if (!user?.email) {
    return [];
  }

  const email = user.email.toLowerCase();
  const emailDomain = email.split('@')[1];

  if (!emailDomain) {
    return [];
  }

  // Each org pulls down its organizationUsers row for the current auth user
  // (if any) so we can drop the orgs the user is already a member of without
  // a separate membership query. Empty array → not yet a member → safe to
  // pre-select in onboarding.
  const userOrganizationUsers = {
    organizationUsers: {
      where: { authUserId: user.id },
      columns: { id: true },
    },
  } as const;

  const [rawResults, preMappedOrgs] = await Promise.all([
    db.query.organizations.findMany({
      where: { domain: emailDomain },
      with: {
        profile: { with: { avatarImage: true } },
        whereWeWork: { with: { location: true } },
        ...userOrganizationUsers,
      },
    }),
    db.query.allowList.findMany({
      where: { email },
      with: {
        organization: {
          with: {
            profile: { with: { avatarImage: true } },
            whereWeWork: { with: { location: true } },
            ...userOrganizationUsers,
          },
        },
      },
    }),
  ]);

  const transformOrg = (org: (typeof rawResults)[number]) => ({
    ...org,
    whereWeWork: org.whereWeWork.map((item) => item.location),
  });

  const orgsById = new Map<
    (typeof rawResults)[number]['id'],
    ReturnType<typeof transformOrg>
  >();

  for (const org of rawResults) {
    if (org.organizationUsers.length === 0) {
      orgsById.set(org.id, transformOrg(org));
    }
  }

  for (const { organization } of preMappedOrgs) {
    if (organization && organization.organizationUsers.length === 0) {
      orgsById.set(organization.id, transformOrg(organization));
    }
  }

  return [...orgsById.values()];
};
