import { db } from '@op/db/client';
import { proposalReviewAssignments } from '@op/db/schema';

export interface AssignableProposal {
  proposalId: string;
  submittedByProfileId: string | null;
  assignedProposalHistoryId: string | null;
}

/**
 * Fans proposals × reviewers into assignment rows — excluding self-review —
 * and inserts them. `onConflictDoNothing` on the (instance, proposal,
 * reviewer, phase) unique constraint makes re-runs safe. Returns the number
 * of rows actually inserted. Shared by generation and backfill.
 */
export async function insertReviewAssignments({
  instanceId,
  phaseId,
  reviewerProfileIds,
  assignableProposals,
}: {
  instanceId: string;
  phaseId: string;
  reviewerProfileIds: string[];
  assignableProposals: AssignableProposal[];
}): Promise<number> {
  const values = assignableProposals.flatMap((proposal) =>
    reviewerProfileIds
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
