import { useFormatter, useNow } from 'next-intl';
import { useMemo } from 'react';

/**
 * Hook to get a locale-aware relative time string for a given date.
 *
 * The hook automatically updates the returned time string at regular intervals
 * (default: every 60 seconds) to keep it current without page refresh.
 *
 * @param dateTime - The date to format (Date object or ISO string)
 * @param options - Configuration options
 * @param options.nowTime - Override the current time (useful for testing)
 * @param options.updateInterval - How often to update the time string in milliseconds (default: 60000)
 *
 * @returns A formatted relative time string (e.g., "5 minutes ago", "hace 5 minutos")
 *
 * @example
 * ```tsx
 * const relativeTime = useRelativeTime(post.createdAt);
 * // Returns: "5 minutes ago" (English) or "hace 5 minutos" (Spanish)
 * ```
 *
 * @example
 * ```tsx
 * // Update every 10 seconds for more recent posts
 * const relativeTime = useRelativeTime(post.createdAt, {
 *   updateInterval: 10000
 * });
 * ```
 */
export function useRelativeTime(
  dateTime: Date | string,
  options?: {
    nowTime?: Date;
    updateInterval?: number;
  },
) {
  const { nowTime, updateInterval = 60000 } = options || {};

  const actualNow = useNow({
    updateInterval,
  });
  const format = useFormatter();

  const now = nowTime ?? actualNow;

  return useMemo(() => {
    const date = new Date(dateTime);
    const diffMs = now.getTime() - date.getTime();

    // "just now" for recent posts (< 5 seconds)
    if (diffMs >= 0 && diffMs < 5000) {
      return 'just now';
    }

    return format.relativeTime(date, now);
  }, [dateTime, format, now]);
}
