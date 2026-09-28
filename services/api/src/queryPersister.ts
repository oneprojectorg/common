import { logger } from '@op/logging/client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// One-way switch. The persister writes on a 1 s trailing timer that holds a
// snapshot from the last cache event, and unsubscribing cannot cancel it, so
// erasing the key is not enough: the sign-out mutation's own success event
// refreshes that snapshot with the signed-out account after the erase. The
// full-page navigation that follows sign-out resets this module.
let persistenceEnded = false;

const storage =
  typeof window === 'undefined'
    ? undefined
    : {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) => {
          if (!persistenceEnded) {
            window.localStorage.setItem(key, value);
          }
        },
        removeItem: (key: string) => window.localStorage.removeItem(key),
      };

export const queryPersister = createSyncStoragePersister({ storage });

export async function clearPersistedQueryCache(): Promise<void> {
  persistenceEnded = true;
  try {
    await queryPersister.removeClient();
  } catch (error) {
    logger.error('Failed to clear the persisted query cache on sign-out', {
      error,
    });
  }
}
