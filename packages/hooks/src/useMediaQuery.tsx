'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Hook that returns true if the media query matches the current window state
 * @param query CSS media query string (e.g. '(max-width: 768px)')
 * @returns boolean indicating if the media query matches
 *
 * Implemented with useSyncExternalStore: the server snapshot is always false,
 * so SSR HTML and the hydration render match (React #418), while components
 * mounted after hydration read the real value synchronously — no false-frame
 * flash on client-side navigations.
 */
const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
};

export default useMediaQuery;
