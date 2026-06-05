'use client';

import { usePostHog } from 'posthog-js/react';
import { useEffect, useRef } from 'react';

/**
 * Fires a PostHog "view" event once per unique view, from the component that
 * actually renders the thing being viewed.
 *
 * Prefer this over tracking inside a tRPC query procedure: a query re-runs on
 * prefetch, refetch, window-refocus, and cache invalidation, none of which is
 * an actual view. A component effect fires on a real render instead.
 *
 * Dedupe is keyed on `dedupeKey` (falling back to the serialized `properties`)
 * rather than the raw `properties` object, so volatile fields — e.g. a
 * `location` that carries query params — don't re-fire the event. Pass a stable
 * identifier (the proposal/process id) as `dedupeKey` when `properties` contains
 * anything that changes within the same logical view.
 *
 * @param event The PostHog event name (e.g. `proposal_viewed`).
 * @param properties Event properties captured on the first view.
 * @param dedupeKey Stable identity for the view; re-firing only happens when it changes.
 */
export function useTrackPageView(
  event: string,
  properties?: Record<string, unknown>,
  dedupeKey?: string,
) {
  const posthog = usePostHog();
  const key = dedupeKey ?? JSON.stringify(properties ?? {});

  // Hold the latest properties without retriggering the effect, so the capture
  // uses fresh values while the effect only depends on the stable key.
  const propertiesRef = useRef(properties);
  propertiesRef.current = properties;

  const trackedKey = useRef<string | null>(null);

  useEffect(() => {
    if (trackedKey.current === key) {
      return;
    }
    trackedKey.current = key;
    posthog.capture(event, propertiesRef.current);
  }, [posthog, event, key]);
}
