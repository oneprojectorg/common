import { useEffect, useRef, useState } from 'react';

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
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

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

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, enabled]);

  return { ref, isIntersecting };
};
