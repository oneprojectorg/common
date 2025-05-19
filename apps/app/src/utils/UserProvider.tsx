'use client';

import { RouterOutput, trpc } from '@op/api/client';
import posthog from 'posthog-js';
import React, { createContext, useContext } from 'react';

// Type for the user data returned by getMyAccount
// You can refine this type by importing the correct type from your trpc/encoders if available
// import type { User } from '@op/api/encoders';

type User = RouterOutput['account']['getMyAccount'];

interface UserContextValue {
  user: User | undefined;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();

  if (user) {
    posthog.identify(user.id, { email: user.email, name: user.name });
  }

  return (
    <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>
  );
};

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
