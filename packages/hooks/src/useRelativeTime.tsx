'use now';

import { useFormatter } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

/**
 * Calculates an adaptive update interval based on how old the content is.
 *
 * @param dateTime - The date to calculate the interval for
 * @returns Update interval in milliseconds, or undefined if no updates needed
 *
 * The intervals are:
 * - < 1 hour: 60 seconds (1 minute)
 * - >= 1 hour: undefined (no auto-updates for old posts)
 */
function getAdaptiveUpdateInterval(
  dateTime: Date | string,
): number | undefined {
  const date = new Date(dateTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // 1 hour or older: don't update automatically
  if (diffMs >= 3_600_000) {
    return undefined;
  }

  // Less than 1 hour old: update every 60 seconds
  return 5_000;
}

/**
 * Hook to get a locale-aware relative time string for a given date.
 *
 * The hook automatically updates the returned time string at adaptive intervals
 * based on the age of the content:
 * - Posts < 1 hour old: update every 60 seconds
 * - Posts >= 1 hour old: no automatic updates (static display)
 *
 * @param dateTime - The date to format (Date object or ISO string)
 * @param options - Configuration options
 * @param options.updateInterval - Override the adaptive update interval with a fixed value in milliseconds
 *
 * @returns A formatted relative time string (e.g., "5 minutes ago", "hace 5 minutos")
 *
 * @example
 * ```tsx
 * const relativeTime = useRelativeTime(post.createdAt);
 * // Returns: "5 minutes ago" (English) or "hace 5 minutos" (Spanish)
 * // Updates automatically every 60 seconds for posts < 1 hour old
 * ```
 *
 * @example
 * ```tsx
 * // Override with a custom fixed interval
 * const relativeTime = useRelativeTime(post.createdAt, {
 *   updateInterval: 30000 // Update every 30 seconds
 * });
 * ```
 */
export function useRelativeTime(
  dateTime: Date | string,
  options?: {
    updateInterval?: number;
  },
) {
  const { updateInterval } = options || {};

  const format = useFormatter();
  const [now, setNow] = useState(new Date());

  const adaptiveInterval =
    updateInterval ?? getAdaptiveUpdateInterval(dateTime);

  // Set up interval to update the current time
  useEffect(() => {
    if (adaptiveInterval === undefined) {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(new Date());
    }, adaptiveInterval);

    return () => clearInterval(intervalId);
  }, [adaptiveInterval]);

  return useMemo(() => {
    const date = new Date(dateTime);
    // const diffMs = now.getTime() - date.getTime();

    // // "now" for recent things (-5 secs < thing < 5 secs)
    // if (diffMs >= -10_000 && diffMs < 10_000) {
    //   // return 'now';
    //   return format.relativeTime(date, {
    //     now: date,
    //     style: 'narrow',
    //   });
    // }

    return format.relativeTime(date, { now, style: 'narrow' });
  }, [dateTime, format, now]);
}
