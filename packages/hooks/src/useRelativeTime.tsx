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
  },
) {
  const { updateInterval } = options || {};

  const format = useFormatter();
  const [updateTrigger, setUpdateTrigger] = useState(0);

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
    let now = new Date();

    const diffMs = now.getTime() - date.getTime();

    // Show "now" for timestamps within ±5 seconds
    if (diffMs >= -5_000 && diffMs < 5_000) {
      now = date;
    }

    return format.relativeTime(date, { now, style: 'narrow' });
  }, [dateTime, updateTrigger, format]);
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

  if (diffMs >= 3_600_000) {
    return undefined;
  }

  return 60_000;
}
