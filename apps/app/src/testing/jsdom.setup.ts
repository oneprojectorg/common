import { vi } from 'vitest';

/**
 * Browser APIs that jsdom lacks and that app dependencies call on their own
 * (`js.foresight` at import via `@/lib/i18n`, `input-otp` on a timer).
 * Loaded for every test; only acts when the file opted into jsdom.
 */
if (typeof window !== 'undefined') {
  document.elementFromPoint = () => null;

  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  );

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}
