import { and, db, desc, eq, isNotNull } from '@op/db/client';
import {
  ProposalReviewRequestState,
  proposalReviewAssignments,
  proposalReviewRequests,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { loadProposalForReviewRead } from './reviewHelpers';
import type { ProposalRevisionNote } from './schemas/reviews';

/**
 * Proposal-scoped: the author's resubmission notes on a single proposal, one
 * group per resubmission, newest first. Each group carries the revision
 * requests that resubmission answered. Same read gate as
 * `listProposalRevisionRequests`: the proposal's authors, decision admins, and
 * any user with the REVIEW capability on the instance.
 *
 * Groups are keyed on `respondedProposalHistoryId` — the proposal version the
 * author resubmitted. `reviewerProfileId` is never selected: revision requests
 * are anonymous to the author and to the other reviewers.
 */
export async function listProposalRevisionNotes({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}) {
  const { proposal } = await loadProposalForReviewRead({
    proposalId,
    subject: 'revision notes',
    user,
    with: {},
  });

  const rows = await db
    .select({
      respondedProposalHistoryId:
        proposalReviewRequests.respondedProposalHistoryId,
      respondedAt: proposalReviewRequests.respondedAt,
      responseComment: proposalReviewRequests.responseComment,
      id: proposalReviewRequests.id,
      requestComment: proposalReviewRequests.requestComment,
      requestedAt: proposalReviewRequests.requestedAt,
    })
    .from(proposalReviewRequests)
    .innerJoin(
      proposalReviewAssignments,
      eq(proposalReviewAssignments.id, proposalReviewRequests.assignmentId),
    )
    .where(
      and(
        eq(proposalReviewAssignments.proposalId, proposalId),
        eq(
          proposalReviewRequests.state,
          ProposalReviewRequestState.RESUBMITTED,
        ),
        // A resubmitted row always carries the version pointer — both writers
        // set it in the same statement as the state — so this only guards
        // against a row no writer produces.
        isNotNull(proposalReviewRequests.respondedProposalHistoryId),
      ),
    )
    .orderBy(
      desc(proposalReviewRequests.respondedAt),
      proposalReviewRequests.respondedProposalHistoryId,
      desc(proposalReviewRequests.requestedAt),
    );

  const groups = new Map<string, ProposalRevisionNote>();

  // The rows arrive ordered by the database, and one resubmission stamps every
  // row it answered with the same comment and timestamp, so the first row of a
  // key carries the note and the rest only add their request.
  for (const row of rows) {
    if (row.respondedProposalHistoryId === null) {
      continue;
    }

    const request = {
      id: row.id,
      requestComment: row.requestComment,
      requestedAt: row.requestedAt,
    };
    const group = groups.get(row.respondedProposalHistoryId);

    if (group) {
      group.requests.push(request);
      continue;
    }

    groups.set(row.respondedProposalHistoryId, {
      respondedProposalHistoryId: row.respondedProposalHistoryId,
      responseComment: row.responseComment,
      respondedAt: row.respondedAt,
      requests: [request],
    });
  }

  return {
    items: [...groups.values()],
    processInstanceId: proposal.processInstanceId,
  };
}
