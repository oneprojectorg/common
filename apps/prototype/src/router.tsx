import {
  type ComponentProps,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * PROTOTYPE ONLY.
 *
 * A hash router, because the whole point of this build is one HTML file with no
 * server behind it — and no server means no path routing. Everything the
 * prototype used from `next/navigation` and the app's i18n `Link` is provided
 * here with the same shapes, so the screens themselves needed no changes.
 *
 * Paths are written exactly as they were in the app (`/prototype/decisions/…`);
 * only the leading `#` is new.
 */
interface Location {
  path: string;
  query: URLSearchParams;
}

const read = (): Location => {
  const raw = window.location.hash.replace(/^#/, '') || '/prototype/decisions';
  const [path, search = ''] = raw.split('?');

  return { path, query: new URLSearchParams(search) };
};

const LocationContext = createContext<Location>({
  path: '/prototype/decisions',
  query: new URLSearchParams(),
});

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<Location>(read);

  useEffect(() => {
    const sync = () => setLocation(read());

    // `hashchange` covers both a click and the back button.
    window.addEventListener('hashchange', sync);
    sync();

    return () => window.removeEventListener('hashchange', sync);
  }, []);

  return (
    <LocationContext.Provider value={location}>
      {children}
    </LocationContext.Provider>
  );
}

export const usePathname = () => useContext(LocationContext).path;
export const useSearchParams = () => useContext(LocationContext).query;

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string) => {
        window.location.hash = href;
      },
      // No history entry: used when a screen corrects its own URL, where a back
      // button that returns to the wrong mode is worse than no entry at all.
      replace: (href: string) => {
        const next = `${window.location.pathname}${window.location.search}#${href}`;

        window.history.replaceState(null, '', next);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      },
      back: () => window.history.back(),
      prefetch: () => undefined,
    }),
    [],
  );
}

/**
 * The params the current path carries. Typed by the caller the way
 * `next/navigation` did it, and read positionally off the two shapes the
 * prototype has: a process, and a phase within it.
 */
export function useParams<T extends Record<string, string>>(): T {
  const path = usePathname();
  const parts = path.split('/').filter(Boolean);
  // ['prototype', 'decisions', <id>, 'phases', <phaseId>]
  const params: Record<string, string> = {};

  if (parts[2] && parts[2] !== 'new') {
    params.id = parts[2];
  }

  if (parts[3] === 'phases' && parts[4]) {
    params.phaseId = parts[4];
  }

  return params as T;
}

export function Link({
  href,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & { href: string }) {
  return <a href={`#${href}`} {...props} />;
}
