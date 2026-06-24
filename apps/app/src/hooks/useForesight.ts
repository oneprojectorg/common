'use client';

import type { ForesightRegisterOptionsWithoutElement } from 'js.foresight';
import { useEffect, useRef } from 'react';

/**
 * Registers an element with the singleton ForesightManager so a callback fires
 * when the user is *predicted* to interact with it (mouse trajectory, keyboard
 * tab focus, scroll, or touch — depending on device). The hook lazy-imports the
 * library so the manager bundle only ships when a registered link first mounts.
 *
 * The returned ref must be attached to the element you want tracked.
 */
export function useForesight<T extends Element = HTMLElement>(
  options: ForesightRegisterOptionsWithoutElement,
) {
  const elementRef = useRef<T | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    let unregister: (() => void) | undefined;
    let cancelled = false;

    void import('js.foresight').then(({ ForesightManager }) => {
      if (cancelled) {
        return;
      }
      const result = ForesightManager.instance.register({
        element,
        ...optionsRef.current,
        callback: (state) => optionsRef.current.callback(state),
      });
      unregister = result.unregister;
    });

    return () => {
      cancelled = true;
      unregister?.();
    };
  }, []);

  return elementRef;
}
