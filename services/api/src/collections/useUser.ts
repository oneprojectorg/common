'use client';

import { eq } from '@tanstack/db';
import { useCallback, useSyncExternalStore } from 'react';

import type { CommonUser } from '../encoders/users';
import { ensureSyncInitialized, usersCollection } from './users';

/**
 * React hook that subscribes to a specific user from the users collection.
 * Returns the user data and automatically re-renders when the user is updated
 * (including optimistic updates).
 *
 * @param userId - The ID of the user to subscribe to
 * @returns The user data, or undefined if not found
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const user = useUser(userId);
 *
 *   if (!user) return <div>User not found</div>;
 *
 *   return <div>{user.profile?.name}</div>;
 * }
 * ```
 */
export function useUser(userId: string): CommonUser | undefined {
  // Ensure sync is initialized on client-side
  ensureSyncInitialized();

  // Subscribe to collection changes for this specific user
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = usersCollection.subscribeChanges(
        () => {
          onStoreChange();
        },
        {
          where: (row) => eq(row.id, userId),
        },
      );

      return () => {
        subscription.unsubscribe();
      };
    },
    [userId],
  );

  // Get the current snapshot of the user
  const getSnapshot = useCallback(() => {
    return usersCollection.get(userId);
  }, [userId]);

  // Server snapshot - return undefined during SSR to avoid hydration issues
  // The component will fall back to initialUser prop on server
  const getServerSnapshot = useCallback(() => undefined, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
