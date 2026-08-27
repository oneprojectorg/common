import { useEffect } from 'react';

import { useIntersectionObserver } from './useIntersectionObserver';

interface UseInfiniteScrollOptions {
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
  /**
   * Scrolling ancestor the sentinel lives in. Defaults to the viewport, which
   * is right for a page-level list; pass the container for a list that scrolls
   * inside a panel or dialog, or `rootMargin` cannot fetch ahead of the bottom.
   */
  root?: Element | null;
}

export const useInfiniteScroll = <T extends HTMLElement = HTMLElement>(
  fetchNextPage: () => void,
  options: UseInfiniteScrollOptions = {},
) => {
  const {
    hasNextPage = false,
    isFetchingNextPage = false,
    threshold = 0.1,
    rootMargin = '100px',
    enabled = true,
    root = null,
  } = options;

  const { ref, isIntersecting } = useIntersectionObserver<T>({
    root,
    threshold,
    rootMargin,
    enabled: enabled && hasNextPage,
  });

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage && enabled) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage, enabled]);

  return {
    ref,
    isIntersecting,
    shouldShowTrigger: hasNextPage && enabled,
  };
};
