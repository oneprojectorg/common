import { logger } from '@op/logging/client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

let stopped = false;

const storage =
  typeof window === 'undefined'
    ? undefined
    : {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) => {
          if (!stopped) {
            window.localStorage.setItem(key, value);
          }
        },
        removeItem: (key: string) => window.localStorage.removeItem(key),
      };

export const queryPersister = createSyncStoragePersister({ storage });

export async function clearPersistedQueryCache(): Promise<void> {
  stopped = true;
  try {
    await queryPersister.removeClient();
  } catch (error) {
    logger.warn('Failed to clear the persisted query cache on sign-out', {
      error,
    });
  }
}
