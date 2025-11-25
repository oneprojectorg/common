'use client';

import { RouterOutput, trpc } from '@op/api/client';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { Permission } from 'access-zones';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import React, { Suspense, createContext, useContext } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

const AccessZones = ['decisions', 'profile', 'admin'] as const;

type CommonZonePermissions = Record<(typeof AccessZones)[number], Permission>;
const defaultPermissions = AccessZones.reduce<CommonZonePermissions>(
  (accum, key) => ({
    ...accum,
    [key]: {
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
  user: OrganizationUser | undefined;
  getPermissionsForProfile: (profileId: string) => CommonZonePermissions;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProviderSuspense = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const { data: user } = useSuspenseQuery({
    queryKey: [['account', 'getMyAccount']],
    queryFn: () => trpc.account.getMyAccount.query(),
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
    if (!user?.organizationUsers) {
      return defaultPermissions;
    }

    // Find the organizationUser that has an organization with a profile matching the profileId
    const matchingOrgUser = user.organizationUsers.find(
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

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      fallback={
        <UserContext.Provider
          value={{
            user: undefined,
            getPermissionsForProfile: () => defaultPermissions,
          }}
        >
          {children}
        </UserContext.Provider>
      }
    >
      <Suspense fallback={null}>
        <UserProviderSuspense>{children}</UserProviderSuspense>
      </Suspense>
    </ErrorBoundary>
  );
};

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
