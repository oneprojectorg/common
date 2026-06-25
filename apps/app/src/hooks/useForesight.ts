'use client';

import {
  ForesightManager,
  type ForesightRegisterOptionsWithoutElement,
  type ForesightRegisterResult,
} from 'js.foresight';
import { useEffect, useRef } from 'react';

// Defaults fire too close to hover; tune for ~2.5× the lead time.
ForesightManager.initialize({
  enableMousePrediction: true,
  enableTabPrediction: true,
  enableScrollPrediction: true,
  trajectoryPredictionTime: 200,
  defaultHitSlop: 50,
  positionHistorySize: 10,
  scrollMargin: 200,
  // Foresight otherwise writes debug attributes (data-active, data-predicted,
  // data-status) onto every registered element. Its `data-active` (= "tracked
  // for prefetch") collides with the data-active our UI components use for
  // selected state — e.g. a sense Tabs trigger rendered as a Link gets styled
  // active on every tab. Off in prod; the foresight devtools can re-enable it.
  setDataAttributes: false,
});

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
