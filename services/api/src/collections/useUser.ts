'use client';

import { eq } from '@tanstack/db';
import { useCallback, useSyncExternalStore } from 'react';

import type { CommonUser } from '../encoders/users';
import { usersCollection } from './users';

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

  // Server snapshot - same as client for this use case
  const getServerSnapshot = getSnapshot;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
