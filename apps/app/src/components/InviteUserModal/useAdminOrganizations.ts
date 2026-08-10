'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { useMemo } from 'react';

export interface AdminOrganizationItem {
  /** `organizations.id` — what `organization.invite` matches on. Not the
   * profile id that `account.getUserProfiles` returns. */
  value: string;
  label: string;
  /** Seeds the email placeholder, so it follows the selected organization. */
  domain: string | null;
}

/**
 * Every organization the viewer administers, as `Select` items. Mirrors the
 * role-name check the server applies in `account.getUserProfiles`; note the
 * invite itself is authorized on the `profile: ADMIN` permission bit, so a
 * custom admin-equivalent role would be missing here.
 */
export const useAdminOrganizations = (): AdminOrganizationItem[] => {
  const { user } = useRequiredUser();

  return useMemo(
    () =>
      (user.organizationUsers ?? [])
        .filter((membership) =>
          membership.roles?.some(
            (role) => role.accessRole?.name?.toLowerCase() === 'admin',
          ),
        )
        .flatMap((membership) => {
          const organization = membership.organization;

          return organization
            ? [
                {
                  value: organization.id,
                  label: organization.profile?.name ?? '',
                  domain: organization.domain ?? null,
                },
              ]
            : [];
        }),
    [user.organizationUsers],
  );
};
