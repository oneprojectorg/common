'use client';

import { useFormatter } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

/**
 * Returns a locale-aware relative time string with adaptive auto-updates.
 * Shows "now" for timestamps within ±5 seconds.
 *
 * @param dateTime - Date to format (Date object or ISO string)
 * @param options.updateInterval - Optional: override adaptive interval (ms)
 * @returns Formatted relative time (e.g., "5m ago", "hace 5m")
 */
export function useRelativeTime(
  dateTime: Date | string,
  options?: {
    updateInterval?: number;
    style?: 'long' | 'short' | 'narrow';
  },
) {
  const { updateInterval, style = 'narrow' } = options || {};

  const format = useFormatter();
  const [updateTrigger, setUpdateTrigger] = useState(0);
  // Relative time depends on the wall clock, which differs between the server
  // render and client hydration (React #418). Until mounted, render a
  // deterministic absolute date instead; the relative string applies after.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const adaptiveInterval =
    updateInterval ?? getAdaptiveUpdateInterval(dateTime);

  // Trigger recalculation at adaptive intervals
  useEffect(() => {
    if (adaptiveInterval === undefined) {
      return;
    }

    const intervalId = setInterval(() => {
      setUpdateTrigger((prev) => prev + 1);
    }, adaptiveInterval);

    return () => clearInterval(intervalId);
  }, [adaptiveInterval]);

  return useMemo(() => {
    const date = new Date(dateTime);

    if (!mounted) {
      // Compact fallback keeps the width close to the post-mount relative
      // string ("2m", "3d") to minimize layout shift when it swaps in.
      return format.dateTime(date, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }

    let now = new Date();

    const diffMs = now.getTime() - date.getTime();

    // Show "now" for timestamps within ±5 seconds
    if (diffMs >= -5_000 && diffMs < 5_000) {
      now = date;
    }

    return format.relativeTime(date, { now, style });
  }, [dateTime, updateTrigger, format, style, mounted]);
}

/**
 * Returns update interval based on content age.
 * < 1 hour: 60s updates, >= 1 hour: no updates
 *
 * For posting and commenting this should work well,
 * do adapt if updates are too frequent or not frequent enough.
 */
function getAdaptiveUpdateInterval(
  dateTime: Date | string,
): number | undefined {
  const date = new Date(dateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // 1 hour
  if (diffMs >= 3_600_000) {
    return undefined;
  }

  // 1 min
  return 60_000;
}
