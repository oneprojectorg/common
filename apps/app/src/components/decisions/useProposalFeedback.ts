'use client';

import { trpc } from '@op/api/client';
import type {
  ProposalFeedbackItem,
  ProposalReviewRequest,
} from '@op/common/client';

export interface ProposalFeedback {
  /** Anonymized reviewer notes, released by the server once their phase ended. */
  notes: Array<ProposalFeedbackItem>;
  /** Every revision request on the proposal, resolved history included. */
  revisionHistory: Array<ProposalReviewRequest>;
  hasFeedback: boolean;
}

/**
 * The author's record of a review, fetched as one unit for the feedback panel.
 * A denied viewer gets empty arrays rather than a thrown error, so the
 * surrounding page still renders.
 */
export function useProposalFeedback({
  proposalId,
  enabled,
}: {
  proposalId: string;
  enabled: boolean;
}): ProposalFeedback {
  const [feedbackQuery, revisionQuery] = trpc.useQueries((t) => [
    t.decision.listProposalFeedback(
      { proposalId },
      { enabled, throwOnError: false },
    ),
    t.decision.listProposalRevisionRequests(
      { proposalId },
      { enabled, throwOnError: false },
    ),
  ]);

  const notes = feedbackQuery.error ? [] : (feedbackQuery.data?.items ?? []);

  const revisionHistory = revisionQuery.error
    ? []
    : (revisionQuery.data?.revisionRequests ?? []).map(
        (item) => item.revisionRequest,
      );

  return {
    notes,
    revisionHistory,
    hasFeedback: notes.length > 0 || revisionHistory.length > 0,
  };
}
