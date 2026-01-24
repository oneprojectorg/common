import type { ChangeMessageOrDeleteKeyMessage } from '@tanstack/db';
import { createCollection } from '@tanstack/db';

import type { CommonUser } from '../encoders/users';

/** Sync primitives captured from TanStack DB sync function */
type SyncPrimitives = {
  begin: (options?: { immediate?: boolean }) => void;
  write: (message: ChangeMessageOrDeleteKeyMessage<CommonUser, string>) => void;
  commit: () => void;
  markReady: () => void;
  truncate: () => void;
};

/** Captured sync primitives for external use */
let syncPrimitives: SyncPrimitives | null = null;

/**
 * Users collection for platform admin user management.
 * Provides optimistic updates for user data with tRPC sync.
 *
 * @example
 * // Subscribe to user changes
 * usersCollection.subscribeChanges((changes) => {
 *   console.log('User changes:', changes);
 * });
 *
 * // Get a user by ID
 * const user = usersCollection.get(userId);
 *
 * // Update a user optimistically
 * const tx = usersCollection.update(userId, (draft) => {
 *   draft.profile = { ...draft.profile, name: 'New Name' };
 * });
 * await tx.isPersisted.promise;
 */
export const usersCollection = createCollection<CommonUser, string>({
  id: 'users',
  getKey: (user) => user.id,
  sync: {
    /**
     * Sync function - captures sync primitives for external use.
     * The actual data population happens via syncUsersToCollection().
     */
    sync: ({ begin, write, commit, markReady, truncate }) => {
      // Capture sync primitives for external use
      syncPrimitives = { begin, write, commit, markReady, truncate };

      // Mark collection as ready immediately - data will be synced via syncUsersToCollection
      markReady();

      // Cleanup function
      return () => {
        syncPrimitives = null;
      };
    },
  },
});

/**
 * Syncs users data to the collection.
 * Call this when you have fresh data from tRPC listAllUsers query.
 *
 * @param users - Array of users to sync to the collection
 * @param options - Sync options
 * @param options.replace - If true, clears existing data before syncing (default: true for first sync)
 *
 * @example
 * ```tsx
 * // In a React component
 * const { data } = useSuspenseQuery(trpcOptions.platform.admin.listAllUsers.queryOptions());
 *
 * useEffect(() => {
 *   syncUsersToCollection(data.items);
 * }, [data.items]);
 * ```
 */
export function syncUsersToCollection(
  users: CommonUser[],
  options?: { replace?: boolean },
): void {
  if (!syncPrimitives) {
    console.warn('usersCollection sync not initialized yet');
    return;
  }

  const { begin, write, commit, truncate } = syncPrimitives;
  const shouldReplace = options?.replace ?? true;

  // Start sync transaction
  begin({ immediate: true });

  // Clear existing data if replacing
  if (shouldReplace) {
    truncate();
  }

  // Write all users to the collection
  for (const user of users) {
    write({
      type: 'insert',
      value: user,
    });
  }

  // Commit the transaction
  commit();
}

/**
 * Updates a single user in the collection from server data.
 * Use this when you receive updated user data from a mutation response.
 *
 * @param user - The user data to update
 */
export function updateUserInCollection(user: CommonUser): void {
  if (!syncPrimitives) {
    console.warn('usersCollection sync not initialized yet');
    return;
  }

  const { begin, write, commit } = syncPrimitives;

  begin({ immediate: true });
  write({
    type: 'update',
    value: user,
  });
  commit();
}

/**
 * Removes a user from the collection.
 *
 * @param userId - The ID of the user to remove
 */
export function removeUserFromCollection(userId: string): void {
  if (!syncPrimitives) {
    console.warn('usersCollection sync not initialized yet');
    return;
  }

  const { begin, write, commit } = syncPrimitives;

  begin({ immediate: true });
  write({
    type: 'delete',
    key: userId,
  });
  commit();
}

export type { CommonUser } from '../encoders/users';
