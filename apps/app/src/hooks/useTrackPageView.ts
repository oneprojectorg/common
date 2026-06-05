'use client';

import { usePostHog } from 'posthog-js/react';
import { type DependencyList, useEffect } from 'react';

/**
 * Fires a PostHog "view" event from the component that renders the thing being
 * viewed, once per `deps` change. Prefer this over tracking inside a tRPC query
 * procedure, which re-runs on prefetch, refetch, window-refocus, and cache
 * invalidation — none of which is an actual view.
 *
 * `deps` controls when the event re-fires (e.g. the proposal/process id), so
 * pass the stable identity of the view there rather than `properties`, which
 * may carry volatile fields like a query-param-bearing `location`.
 */
export function useTrackPageView(
  event: string,
  properties?: Record<string, unknown>,
  deps: DependencyList = [],
) {
  const posthog = usePostHog();

  useEffect(() => {
    posthog.capture(event, properties);
  }, [posthog, event, ...deps]);
}
