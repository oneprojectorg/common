'use client';

import {
  ForesightManager,
  type ForesightRegisterOptionsWithoutElement,
  type ForesightRegisterResult,
} from 'js.foresight';
import { useEffect, useRef } from 'react';

// Tune the singleton more aggressively than ForesightJS' defaults so a
// prefetch fires well before the cursor is on top of the link. Initialize
// runs at client bundle load (before any `useForesight` effect), and because
// the manager is a singleton subsequent calls are a no-op — we own this
// configuration. Knobs documented at
// https://foresightjs.com/docs/getting_started/config.
//
// - `trajectoryPredictionTime`: ms of mouse motion to extrapolate. Defaults
//   to ~80ms (close to "already hovering"); 200ms gives ~2.5× the lead-time
//   without being so loud it fires from idle cursor jitter.
// - `defaultHitSlop`: invisible px buffer around every registered element. 0
//   means the trajectory has to land on the link itself; 50 widens the
//   catchment so cursor lanes near (but not over) a link still count.
// - `positionHistorySize` / `scrollMargin`: slightly larger windows so
//   trajectory smoothing and scroll-direction inference are less twitchy.
ForesightManager.initialize({
  enableMousePrediction: true,
  enableTabPrediction: true,
  enableScrollPrediction: true,
  trajectoryPredictionTime: 200,
  defaultHitSlop: 50,
  positionHistorySize: 10,
  scrollMargin: 200,
});

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
