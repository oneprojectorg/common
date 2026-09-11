'use client';

import { trpc } from '@op/api/client';
import {
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  type ProposalRevisionNote,
} from '@op/common/client';

export interface ProposalReviewNotes {
  /** Requests the author still has to answer. */
  openRequests: Array<ProposalReviewRequest>;
  /**
   * Every past revision cycle, newest first: the author's note plus the
   * requests that one resubmission answered. Grouped by the server.
   */
  noteGroups: Array<ProposalRevisionNote>;
  /** Whether the "Review notes" sheet has anything to show. */
  hasReviewNotes: boolean;
}

/**
 * The whole record of a proposal's revision cycles, read as one unit for the
 * "Review notes" sheet: the open requests plus every cycle already answered.
 * A denied viewer gets empty arrays rather than a thrown error, so the
 * surrounding page still renders.
 */
export function useProposalReviewNotes({
  proposalId,
  enabled,
}: {
  proposalId: string;
  enabled: boolean;
}): ProposalReviewNotes {
  const [requestQuery, noteQuery] = trpc.useQueries((t) => [
    t.decision.listProposalRevisionRequests(
      { proposalId, states: [ProposalReviewRequestState.REQUESTED] },
      { enabled, throwOnError: false },
    ),
    t.decision.listProposalRevisionNotes(
      { proposalId },
      { enabled, throwOnError: false },
    ),
  ]);

  const openRequests = (
    requestQuery.error ? [] : (requestQuery.data?.items ?? [])
  ).map((item) => item.revisionRequest);

  const noteGroups = noteQuery.error ? [] : (noteQuery.data?.items ?? []);

  return {
    openRequests,
    noteGroups,
    hasReviewNotes: openRequests.length > 0 || noteGroups.length > 0,
  };
}
