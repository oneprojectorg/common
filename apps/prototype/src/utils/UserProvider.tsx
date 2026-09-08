import { createContext, type ReactNode, useContext } from 'react';

import type { PrototypeUser } from '../components/prototype/fakeUser';

/**
 * PROTOTYPE ONLY.
 *
 * Stands in for the app's session provider. Nothing in the prototype reads the
 * context — the chrome takes the fake user directly — but the shell still wraps
 * in it, so the shape is kept rather than deleting a call site that documents
 * where a real session would enter.
 */
const UserContext = createContext<PrototypeUser | undefined>(undefined);

export const UserProvider = ({
  initialUser,
  children,
}: {
  initialUser: PrototypeUser;
  children: ReactNode;
}) => (
  <UserContext.Provider value={initialUser}>{children}</UserContext.Provider>
);

export const useMaybeUser = () => useContext(UserContext);

export function useUser() {
  const user = useContext(UserContext);

  if (!user) {
    throw new Error('useUser must be used inside a UserProvider');
  }

  return user;
}
