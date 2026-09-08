import { useEffect, useState } from 'react';

/**
 * PROTOTYPE ONLY.
 *
 * The one hook the prototype wanted from `@op/hooks`. Local because that
 * package's index also carries a cookie helper that reads `process.env`, which
 * does not exist in a browser bundle — importing one hook pulled the whole
 * server-shaped subtree in with it.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);

    sync();
    list.addEventListener('change', sync);

    return () => list.removeEventListener('change', sync);
  }, [query]);

  return matches;
}
