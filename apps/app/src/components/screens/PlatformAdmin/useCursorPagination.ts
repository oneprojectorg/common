import { useState } from 'react';

/**
 * Custom hook for managing cursor-based pagination state.
 *
 * This maintains a history of cursors to enable backward navigation without
 * requiring the API to support bidirectional queries. The API only needs to
 * return the next cursor and a hasMore flag.
 *
 * @param limit - Number of items per page
 * @returns Pagination state and navigation handlers
 *
 * @example
 * const { cursor, currentPage, handleNext, handlePrevious } = useCursorPagination(10);
 * const [data] = trpc.users.list.useSuspenseQuery({ cursor, limit: 10 });
 *
 * @todo Move this to @op/common or @op/hooks for reuse across the application
 */
export function useCursorPagination(limit: number) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);

  // Current page is derived from the length of cursor history
  // Page 1 = [null], Page 2 = [null, "cursor_abc"], etc.
  const currentPage = cursorHistory.length - 1;

  /**
   * Navigate to the next page using the provided cursor.
   * Adds the new cursor to history for backward navigation.
   *
   * @param nextCursor - The cursor for the next page (from API response)
   */
  const handleNext = (nextCursor: string) => {
    setCursorHistory([...cursorHistory, nextCursor]);
    setCursor(nextCursor);
  };

  /**
   * Navigate to the previous page by popping the current cursor
   * from history and using the previous one.
   */
  const handlePrevious = () => {
    if (cursorHistory.length > 1) {
      const newHistory = [...cursorHistory];
      newHistory.pop();
      setCursorHistory(newHistory);
      setCursor(newHistory[newHistory.length - 1] ?? null);
    }
  };

  /**
   * Check if backward navigation is possible.
   */
  const canGoPrevious = cursorHistory.length > 1;

  /**
   * Reset pagination to the first page.
   * Useful when filters or search queries change.
   */
  const reset = () => {
    setCursor(null);
    setCursorHistory([null]);
  };

  return {
    cursor,
    currentPage,
    limit,
    handleNext,
    handlePrevious,
    canGoPrevious,
    reset,
  };
}
