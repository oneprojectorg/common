'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that returns true if the media query matches the current window state
 * @param query CSS media query string (e.g. '(max-width: 768px)')
 * @returns boolean indicating if the media query matches
 */
const useMediaQuery = (query: string): boolean => {
  // Initialize with the current match state
  const [matches, setMatches] = useState<boolean>(() => {
    // Check if window is defined (client-side)
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }

    return false; // Default to false on server-side
  });

  useEffect(() => {
    // Return early if window is not defined (server-side)
    if (typeof window === 'undefined') return () => {};

    const mediaQuery = window.matchMedia(query);

    // Update matches when the media query status changes
    const updateMatches = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Add event listener
    mediaQuery.addEventListener('change', updateMatches);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', updateMatches);
    };
  }, [query]);

  return matches;
};

export default useMediaQuery;
