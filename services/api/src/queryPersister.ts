import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// One-way switch. The persister writes on a 1 s trailing timer that holds a
// snapshot from the last cache event, and unsubscribing cannot cancel it, so
// erasing the key is not enough: the sign-out mutation's own success event
// refreshes that snapshot with the signed-out account after the erase. The
// full-page navigation that follows sign-out resets this module.
let persistenceEnded = false;

// Android WebViews can hand out a null localStorage; the persister treats a
// missing storage as "do not persist", so keep that path instead of wrapping.
const localStorage =
  typeof window === 'undefined' ? undefined : window.localStorage;

const storage = localStorage
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        if (!persistenceEnded) {
          localStorage.setItem(key, value);
        }
      },
      removeItem: (key: string) => localStorage.removeItem(key),
    }
  : undefined;

export const queryPersister = createSyncStoragePersister({ storage });

export function clearPersistedQueryCache(): void {
  persistenceEnded = true;
  queryPersister.removeClient();
}
