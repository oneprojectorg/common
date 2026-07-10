import { useEffect, useState } from 'react';

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
      ([entry]) => {
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
    };
  }, [node, threshold, rootMargin, enabled]);

  return { ref: setNode, isIntersecting };
};
