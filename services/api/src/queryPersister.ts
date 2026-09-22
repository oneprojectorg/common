'use client';

import { logger } from '@op/logging/client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * The persister behind `PersistQueryClientProvider`. `storage: undefined`
 * during SSR makes every operation a no-op on the server.
 */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});

/**
 * Erase the persisted React Query cache.
 *
 * Sign-out must call this. The in-memory cache dies with the full-page
 * navigation that follows a sign-out, but the persisted copy outlives it: the
 * provider restores it on the next load, so on a shared browser the next
 * person can see the previous account's query payloads rendered before
 * anything revalidates.
 *
 * Never throws — a blocked or full `localStorage` must not block a sign-out.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    await queryPersister.removeClient();
  } catch (error) {
    logger.warn('Failed to clear the persisted query cache on sign-out', {
      error,
    });
  }
}
