import { type RefCallback, useEffect, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
  /**
   * Value to use before the observer first reports. Defaults to `false`.
   * Set to `true` when deriving an inverse state (e.g. "stuck" =
   * `!isIntersecting`) so the element doesn't read as intersecting-inverse for
   * one frame on mount.
   */
  initialIsIntersecting?: boolean;
}

export const useIntersectionObserver = <T extends HTMLElement = HTMLElement>(
  options: UseIntersectionObserverOptions = {},
) => {
  const {
    threshold = 0,
    rootMargin = '0px',
    enabled = true,
    initialIsIntersecting = false,
  } = options;
  const [isIntersecting, setIsIntersecting] = useState(initialIsIntersecting);
  // The observed node is state (set via callback ref), not a ref, so the
  // observer re-attaches when the element mounts later than this hook's
  // effect — e.g. a sentinel inside a Suspense boundary that resolves after
  // the first commit.
  const [node, setNode] = useState<T | null>(null);

  useEffect(() => {
    if (!enabled || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Entries are chronological; only the newest reflects current state.
        const entry = entries[entries.length - 1];
        if (entry) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      // Without a live observer nothing can correct a frozen `true`, and a
      // stale intersecting state re-triggers consumers (e.g. a spurious
      // fetchNextPage) the moment they re-enable.
      setIsIntersecting(initialIsIntersecting);
    };
  }, [node, threshold, rootMargin, enabled, initialIsIntersecting]);

  // Typed as a plain callback ref so the state-setter implementation detail
  // doesn't leak into consumers' prop types.
  const ref: RefCallback<T> = setNode;

  return { ref, isIntersecting };
};
