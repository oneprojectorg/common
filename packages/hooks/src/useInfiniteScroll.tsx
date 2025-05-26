import { useEffect } from 'react';
import { useIntersectionObserver } from './useIntersectionObserver';

interface UseInfiniteScrollOptions {
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export const useInfiniteScroll = (
  fetchNextPage: () => void,
  options: UseInfiniteScrollOptions = {}
) => {
  const {
    hasNextPage = false,
    isFetchingNextPage = false,
    threshold = 0.1,
    rootMargin = '100px',
    enabled = true,
  } = options;

  const { ref, isIntersecting } = useIntersectionObserver({
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