import { db } from '@op/db/client';
import { proposalReviewAssignments } from '@op/db/schema';

export interface AssignableProposal {
  proposalId: string;
  submittedByProfileId: string | null;
  assignedProposalHistoryId: string | null;
  /**
   * The reviewers to assign this proposal. For `all` coverage the caller fans
   * the shared eligible list into every proposal; for `by_category` each
   * proposal carries only its category-scoped reviewers.
   */
  reviewerProfileIds: string[];
}

/**
 * Fans proposals × their reviewers into assignment rows — excluding
 * self-review — and inserts them. `onConflictDoNothing` on the (instance,
 * proposal, reviewer, phase) unique constraint makes re-runs safe and dedupes
 * overlapping per-proposal sets. Returns the number of rows inserted. Shared
 * by generation and backfill.
 */
export async function insertReviewAssignments({
  instanceId,
  phaseId,
  assignableProposals,
}: {
  instanceId: string;
  phaseId: string;
  assignableProposals: AssignableProposal[];
}): Promise<number> {
  const values = assignableProposals.flatMap((proposal) =>
    proposal.reviewerProfileIds
      // NOTE: we should revisit this logic when we have multiple authors per proposal
      .filter((profileId) => profileId !== proposal.submittedByProfileId)
      .map((profileId) => ({
        processInstanceId: instanceId,
        proposalId: proposal.proposalId,
        reviewerProfileId: profileId,
        phaseId,
        assignedProposalHistoryId: proposal.assignedProposalHistoryId,
      })),
  );

  if (values.length === 0) {
    return 0;
  }

  const insertedRows = await db
    .insert(proposalReviewAssignments)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: proposalReviewAssignments.id });

  return insertedRows.length;
}
