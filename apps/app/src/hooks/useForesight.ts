'use client';

import {
  ForesightManager,
  type ForesightRegisterOptionsWithoutElement,
  type ForesightRegisterResult,
} from 'js.foresight';
import { useEffect, useRef } from 'react';

/**
 * Registers an element with the singleton ForesightManager so a callback fires
 * when the user is *predicted* to interact with it (mouse trajectory, keyboard
 * tab focus, scroll, or touch — depending on device).
 *
 * Mirrors the canonical React hook from the ForesightJS docs, with two
 * deliberate departures:
 *
 *  - **`unregister` on unmount.** The docs' minimal example skips cleanup; we
 *    return it from the effect so removing a component reliably stops tracking.
 *  - **Stable registration across renders.** The docs' `[options]` dep array
 *    re-registers whenever the parent inlines `options` (the common case). We
 *    keep the options behind a ref so the callback always reads the latest
 *    closure while registration itself happens once per mount.
 */
export function useForesight<T extends HTMLElement = HTMLElement>(
  options: ForesightRegisterOptionsWithoutElement,
) {
  const elementRef = useRef<T | null>(null);
  const registerResults = useRef<ForesightRegisterResult | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    registerResults.current = ForesightManager.instance.register({
      element,
      ...optionsRef.current,
      callback: (state) => optionsRef.current.callback(state),
    });

    return () => {
      registerResults.current?.unregister();
      registerResults.current = null;
    };
  }, []);

  return { elementRef, registerResults };
}
