/**
 * TanStack DB Collections
 *
 * This module exports all collections used for optimistic updates
 * in the platform admin screens.
 */

export {
  usersCollection,
  syncUsersToCollection,
  updateUserInCollection,
  removeUserFromCollection,
  ensureSyncInitialized,
  type CommonUser,
} from './users';

export { useUser } from './useUser';
