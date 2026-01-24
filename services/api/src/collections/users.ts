import { createCollection } from '@tanstack/db';

import type { CommonUser } from '../encoders/users';

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
     * Sync function - called to populate the collection with data.
     * In this case, we'll sync from tRPC queries.
     */
    sync: ({ collection }) => {
      // Initial sync is handled by the syncer in the parent component
      // This is a placeholder that marks the collection as ready
      // The actual data population happens via collection state updates
      collection.isReady();
    },
  },
});

export type { CommonUser } from '../encoders/users';
