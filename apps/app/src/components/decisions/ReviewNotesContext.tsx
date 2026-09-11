'use client';

import { type ReactNode, createContext, useContext } from 'react';

/**
 * Derived booleans rather than the notes themselves: the header and layout only
 * decide what to show, and raw arrays would re-render them on every refetch.
 */
export interface ReviewNotesState {
  proposalId: string;
  hasReviewNotes: boolean;
  hasUnread: boolean;
  hasOpenRequests: boolean;
  isOpen: boolean;
  toggle: () => void;
}

const ReviewNotesContext = createContext<ReviewNotesState | null>(null);

export function ReviewNotesProvider({
  value,
  children,
}: {
  value: ReviewNotesState;
  children: ReactNode;
}) {
  return (
    <ReviewNotesContext.Provider value={value}>
      {children}
    </ReviewNotesContext.Provider>
  );
}

/** Null on the legacy editor, which mounts no provider and no revision cycle. */
export function useOptionalReviewNotes(): ReviewNotesState | null {
  return useContext(ReviewNotesContext);
}
