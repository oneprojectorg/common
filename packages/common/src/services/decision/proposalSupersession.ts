import {
  type Column,
  type SQL,
  and,
  db,
  eq,
  isNull,
  notExists,
} from '@op/db/client';
import { ProposalRelationshipType, proposalRelationships } from '@op/db/schema';

// Both ends take a literal id or a correlated column, so the read predicate and
// the lookup below share one definition.
const liveMergedEdge = (
  processInstanceId: string | Column | SQL,
  sourceProposalId: string | Column | SQL,
): SQL =>
  and(
    eq(proposalRelationships.processInstanceId, processInstanceId),
    eq(proposalRelationships.sourceProposalId, sourceProposalId),
    eq(proposalRelationships.relationshipType, ProposalRelationshipType.MERGED),
    isNull(proposalRelationships.deletedAt),
  )!;

/**
 * Excludes rows whose proposal was merged into another. Pass the correlated
 * columns of the query being built — the proposals table's own `id`, or the
 * `proposalId` of something that references one (a review assignment).
 */
export const notSuperseded = ({
  proposalId,
  processInstanceId,
}: {
  proposalId: Column | SQL;
  processInstanceId: string | Column;
}): SQL =>
  notExists(
    db
      .select({ id: proposalRelationships.id })
      .from(proposalRelationships)
      .where(liveMergedEdge(processInstanceId, proposalId)),
  );

/**
 * The live `merged` edge leading away from a proposal, or `undefined` when it
 * hasn't been superseded. The target always resolves: both endpoints carry a
 * composite foreign key, so an edge cannot outlive either proposal.
 */
export async function findLiveMergedEdge({
  processInstanceId,
  sourceProposalId,
}: {
  processInstanceId: string;
  sourceProposalId: string;
}): Promise<{ id: string; targetProposalId: string } | undefined> {
  const [edge] = await db
    .select({
      id: proposalRelationships.id,
      targetProposalId: proposalRelationships.targetProposalId,
    })
    .from(proposalRelationships)
    .where(liveMergedEdge(processInstanceId, sourceProposalId))
    .limit(1);

  return edge;
}
