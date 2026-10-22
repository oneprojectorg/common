import { and, db, desc, eq } from '@op/db/client';
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
 * author resubmitted — falling back to the request's own id when that pointer
 * is null. The writer always sets it, but the FK is `onDelete: 'set null'`, so
 * a resubmitted request outlives the snapshot it pointed to; without the
 * fallback, that note would silently disappear instead of standing alone.
 * `reviewerProfileId` is never selected: revision requests are anonymous to
 * the author and to the other reviewers.
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
  // key carries the note and the rest only add their request. A row whose
  // pointer was nulled out by the history snapshot's deletion has no sibling
  // to group with, so it keys on its own id and stands alone.
  for (const row of rows) {
    const groupKey = row.respondedProposalHistoryId ?? row.id;

    const request = {
      id: row.id,
      requestComment: row.requestComment,
      requestedAt: row.requestedAt,
    };
    const group = groups.get(groupKey);

    if (group) {
      group.requests.push(request);
      continue;
    }

    groups.set(groupKey, {
      respondedProposalHistoryId: groupKey,
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
