'use client';

import { RouterOutput, trpc } from '@op/api/client';
import type { Permission } from 'access-zones';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import React, { Suspense, createContext, useContext } from 'react';

const AccessZones = ['decisions', 'profile', 'admin'] as const;

type CommonZonePermissions = Record<(typeof AccessZones)[number], Permission>;
const defaultPermissions = AccessZones.reduce<CommonZonePermissions>(
  (accum, key) => ({
    ...accum,
    [key]: {
      admin: false,
      create: false,
      read: false,
      update: false,
      delete: false,
    },
  }),
  {} as CommonZonePermissions,
);

// Type for the user data returned by getMyAccount
// You can refine this type by importing the correct type from your trpc/encoders if available
// import type { User } from '@op/api/encoders';

export type OrganizationUser = RouterOutput['account']['getMyAccount'];

interface UserContextValue {
  user: OrganizationUser;
  getPermissionsForProfile: (profileId: string) => CommonZonePermissions;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProviderSuspense = ({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: OrganizationUser;
}) => {
  const router = useRouter();
  // Use initialUser as initialData to avoid SSR fetch, then revalidate on client
  const [user] = trpc.account.getMyAccount.useSuspenseQuery(undefined, {
    initialData: initialUser,
  });

  if (user.organizationUsers?.length === 0) {
    router.push('/start');
  }

  // We are only identifying One Project users by email.
  if (user && user.email.match(/.+@oneproject\.org$|.+@peoplepowered\.org$/)) {
    posthog.identify(user.authUserId, { email: user.email, name: user.name });
  } else {
    // others are given anonymous IDs
    posthog.identify(user.authUserId);
  }

  // Utility function to get permissions for a specific profile
  const getPermissionsForProfile = (
    profileId: string,
  ): CommonZonePermissions => {
    // First check profileUsers for a direct profile match
    const matchingProfileUser = user.profileUsers?.find(
      (profileUser) => profileUser.profileId === profileId,
    );

    if (matchingProfileUser?.permissions) {
      return { ...defaultPermissions, ...matchingProfileUser.permissions };
    }

    // Fall back to organizationUsers by matching the org's profile
    const matchingOrgUser = user.organizationUsers?.find(
      (orgUser) => orgUser.organization?.profile?.id === profileId,
    );

    return { ...defaultPermissions, ...(matchingOrgUser?.permissions || {}) };
  };

  const contextValue = {
    user,
    getPermissionsForProfile,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
};

export const UserProvider = ({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: OrganizationUser;
}) => {
  return (
    <Suspense fallback={null}>
      <UserProviderSuspense initialUser={initialUser}>
        {children}
      </UserProviderSuspense>
    </Suspense>
  );
};

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
