'use client';

import { trpc } from '@op/api/client';
import type { ProposalFeedbackItem } from '@op/common/client';

export interface ProposalFeedback {
  /** Anonymized reviewer notes, released by the server once their phase ended. */
  notes: Array<ProposalFeedbackItem>;
  hasFeedback: boolean;
}

/**
 * The reviewer notes released to the author, for the feedback panel. Revision
 * requests are not here: the "Review notes" sheet owns that record.
 *
 * A denied viewer gets an empty array rather than a thrown error, so the
 * surrounding page still renders.
 */
export function useProposalFeedback({
  proposalId,
  enabled,
}: {
  proposalId: string;
  enabled: boolean;
}): ProposalFeedback {
  const feedbackQuery = trpc.decision.listProposalFeedback.useQuery(
    { proposalId },
    { enabled, throwOnError: false },
  );

  const notes = feedbackQuery.error ? [] : (feedbackQuery.data?.items ?? []);

  return {
    notes,
    hasFeedback: notes.length > 0,
  };
}
