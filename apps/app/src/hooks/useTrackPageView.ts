'use client';

import { usePostHog } from 'posthog-js/react';
import { type DependencyList, useEffect } from 'react';

/**
 * Fires a PostHog "view" event once per `deps` change. Pass the stable identity
 * of the view (e.g. the proposal/process id) as `deps`, not `properties`.
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
