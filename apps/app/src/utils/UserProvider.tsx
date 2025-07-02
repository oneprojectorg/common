'use client';

import { RouterOutput, trpc } from '@op/api/client';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import React, { Suspense, createContext, useContext } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

// Type for the user data returned by getMyAccount
// You can refine this type by importing the correct type from your trpc/encoders if available
// import type { User } from '@op/api/encoders';

export type OrganizationUser = RouterOutput['account']['getMyAccount'];

interface UserContextValue {
  user: OrganizationUser | undefined;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProviderSuspense = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();

  if (user.organizationUsers?.length === 0) {
    router.push('/start');
  }

  // We are only identifying One Project users by email.
  if (user && user.email.match(/.+@oneproject\.org$/)) {
    posthog.identify(user.id, { email: user.email, name: user.name });
  }

  return (
    <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>
  );
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary fallback={
      <UserContext.Provider value={{ user: undefined }}>
        {children}
      </UserContext.Provider>
    }>
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
