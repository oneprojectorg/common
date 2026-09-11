'use client';

import { trpc } from '@op/api/client';
import {
  type ProposalFeedbackItem,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  type ProposalRevisionNote,
} from '@op/common/client';
import { useQueryStates } from 'nuqs';
import { useCallback } from 'react';

import {
  proposalEditorReviewRevisionParser,
  proposalFeedbackPanelParser,
  proposalReviewNotesParser,
} from './proposalEditor/proposalEditorAsideParams';
import { useProposalFeedback } from './useProposalFeedback';

export interface ProposalReviewNotes {
  /** Requests the author still has to answer, on the current phase alone. */
  openRequests: Array<ProposalReviewRequest>;
  /**
   * Every past revision cycle, newest first: the author's note plus the
   * requests that one resubmission answered. Grouped by the server.
   */
  noteGroups: Array<ProposalRevisionNote>;
  /** Anonymized reviewer notes, released once their review phase ended. */
  feedbackNotes: Array<ProposalFeedbackItem>;
  /** Whether the "Review notes" sheet has anything to show. */
  hasReviewNotes: boolean;
  /** Marks the disclosure with a dot while the author owes an answer. */
  hasUnread: boolean;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * The whole record of a proposal's review notes, read as one unit for the
 * "Review notes" sheet: the open revision requests, every cycle already
 * answered, and the released reviewer notes. Owns the sheet's query state too,
 * so the two surfaces that render it cannot drift.
 *
 * A denied viewer gets empty arrays rather than a thrown error, so the
 * surrounding page still renders.
 */
export function useProposalReviewNotes({
  proposalId,
  phaseId,
  enabled,
  onOpen,
}: {
  proposalId: string;
  /**
   * The instance's current phase — what `submitProposalRevision` answers
   * requests against. `null` (no phase configured) means nothing is
   * answerable, so no open request is read at all.
   */
  phaseId: string | null;
  enabled: boolean;
  /** Runs as the sheet opens; the editor uses it to close its other aside. */
  onOpen?: () => void;
}): ProposalReviewNotes {
  const [
    { reviewNotes: isReviewNotesRequested, reviewRevision, feedback },
    setQueryState,
  ] = useQueryStates({
    reviewNotes: proposalReviewNotesParser,
    reviewRevision: proposalEditorReviewRevisionParser,
    feedback: proposalFeedbackPanelParser,
  });

  const [requestQuery, noteQuery] = trpc.useQueries((t) => [
    t.decision.listProposalRevisionRequests(
      {
        proposalId,
        states: [ProposalReviewRequestState.REQUESTED],
        phaseId: phaseId ?? undefined,
      },
      { enabled: enabled && phaseId !== null, throwOnError: false },
    ),
    // Deliberately unfiltered: the answered cycles of earlier phases are part
    // of the record the sheet shows.
    t.decision.listProposalRevisionNotes(
      { proposalId },
      { enabled, throwOnError: false },
    ),
  ]);

  const { notes: feedbackNotes, hasFeedback } = useProposalFeedback({
    proposalId,
    enabled,
  });

  const openRequests = (
    requestQuery.error ? [] : (requestQuery.data?.items ?? [])
  ).map((item) => item.revisionRequest);

  const noteGroups = noteQuery.error ? [] : (noteQuery.data?.items ?? []);

  const hasReviewNotes =
    openRequests.length > 0 || noteGroups.length > 0 || hasFeedback;

  const setOpen = useCallback(
    (open: boolean) => {
      if (open) {
        onOpen?.();
      }

      // `reviewRevision` and `feedback` are deep links from the notification
      // emails, so closing has to clear them too or the sheet reopens.
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

  // `?reviewRevision=<id>` names one request and `?feedback=true` named the
  // panel that has since merged in; both stay working aliases for the sheet.
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
