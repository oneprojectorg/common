'use client';

import { useTRPC } from '@op/api/client';
import {
  type ProposalFeedbackItem,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  type ProposalRevisionNote,
} from '@op/common/client';
import { useQueries } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useCallback, useMemo } from 'react';

import {
  proposalEditorReviewRevisionParser,
  proposalFeedbackPanelParser,
  proposalReviewNotesParser,
} from './proposalEditor/proposalEditorAsideParams';
import { useProposalFeedback } from './useProposalFeedback';

export interface ProposalReviewNotes {
  openRequests: Array<ProposalReviewRequest>;
  noteGroups: Array<ProposalRevisionNote>;
  feedbackNotes: Array<ProposalFeedbackItem>;
  hasReviewNotes: boolean;
  hasUnread: boolean;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** The "Review notes" sheet's contents and its open state, read as one unit. */
export function useProposalReviewNotes({
  proposalId,
  phaseId,
  enabled,
  onOpen,
}: {
  proposalId: string;
  /** The instance's current phase; `null` leaves nothing answerable. */
  phaseId: string | null;
  enabled: boolean;
  onOpen?: () => void;
}): ProposalReviewNotes {
  const trpc = useTRPC();
  const [
    { reviewNotes: isReviewNotesRequested, reviewRevision, feedback },
    setQueryState,
  ] = useQueryStates({
    reviewNotes: proposalReviewNotesParser,
    reviewRevision: proposalEditorReviewRevisionParser,
    feedback: proposalFeedbackPanelParser,
  });

  const [requestQuery, noteQuery] = useQueries({
    queries: [
      trpc.decision.listProposalRevisionRequests.queryOptions(
        {
          proposalId,
          states: [ProposalReviewRequestState.REQUESTED],
          phaseId: phaseId ?? undefined,
        },
        { enabled: enabled && phaseId !== null, throwOnError: false },
      ),
      // Unfiltered on purpose: earlier phases' answered cycles belong here too.
      trpc.decision.listProposalRevisionNotes.queryOptions(
        { proposalId },
        { enabled, throwOnError: false },
      ),
    ],
  });

  const { notes: feedbackNotes, hasFeedback } = useProposalFeedback({
    proposalId,
    enabled,
  });

  // Memoized so a consumer reading these keeps a stable prop identity; the
  // `.map()` and the `[]` fallback would otherwise be new arrays each render.
  const openRequests = useMemo(
    () =>
      (requestQuery.error ? [] : (requestQuery.data?.items ?? [])).map(
        (item) => item.revisionRequest,
      ),
    [requestQuery.data, requestQuery.error],
  );

  const noteGroups = useMemo(
    () => (noteQuery.error ? [] : (noteQuery.data?.items ?? [])),
    [noteQuery.data, noteQuery.error],
  );

  const hasReviewNotes =
    openRequests.length > 0 || noteGroups.length > 0 || hasFeedback;

  const setOpen = useCallback(
    (open: boolean) => {
      if (open) {
        onOpen?.();
      }

      // Closing has to clear the deep-link params too, or the sheet reopens.
      void setQueryState(
        {
          reviewNotes: open ? true : null,
          reviewRevision: null,
          feedback: null,
        },
        { history: 'push', scroll: false },
      );
    },
    [onOpen, setQueryState],
  );

  // `?reviewRevision=<id>` and `?feedback=true` are email deep-link aliases.
  const isOpen =
    hasReviewNotes &&
    (isReviewNotesRequested || Boolean(reviewRevision) || feedback);

  const toggle = useCallback(() => setOpen(!isOpen), [isOpen, setOpen]);

  return {
    openRequests,
    noteGroups,
    feedbackNotes,
    hasReviewNotes,
    hasUnread: openRequests.length > 0,
    isOpen,
    setOpen,
    toggle,
  };
}
