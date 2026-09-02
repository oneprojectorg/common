import {
  type Column,
  type SQL,
  and,
  db,
  eq,
  isNull,
  notExists,
} from '@op/db/client';
import {
  ProposalRelationshipType,
  profiles,
  proposalRelationships,
  proposals,
} from '@op/db/schema';

import { needsNoAccessException } from './proposalVisibility';

/** A live `merged` edge pointing *at* `targetProposalId`. */
const liveMergeInto = (targetProposalId: string): SQL =>
  and(
    eq(proposalRelationships.targetProposalId, targetProposalId),
    eq(proposalRelationships.relationshipType, ProposalRelationshipType.MERGED),
    isNull(proposalRelationships.deletedAt),
  )!;

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
 * The proposals merged into `targetProposalId`, in merge order. That order
 * lives on the edge rather than on `proposals`, so every caller that wants it
 * has to read it from here.
 *
 * Returns ids only — the rows they name still need the caller's own visibility
 * filter before anything derived from them is surfaced.
 */
export async function getMergedSourceProposalIds({
  targetProposalId,
}: {
  targetProposalId: string;
}): Promise<string[]> {
  const edges = await db
    .select({ sourceProposalId: proposalRelationships.sourceProposalId })
    .from(proposalRelationships)
    .where(liveMergeInto(targetProposalId))
    .orderBy(proposalRelationships.createdAt, proposalRelationships.id);

  return edges.map((edge) => edge.sourceProposalId);
}

/**
 * The proposals merged into `targetProposalId` that the caller could open,
 * with the profile each one is named by, in merge order.
 *
 * One statement rather than an id read followed by a lookup: the ids are only
 * ever used to fetch these rows, and the two-step made the round trips serial.
 * `needsNoAccessException` is the visibility floor `getMergedSourceProposalIds`
 * leaves to its callers, applied here.
 */
export async function getVisibleMergedSourceProfiles({
  targetProposalId,
}: {
  targetProposalId: string;
}): Promise<Array<{ profileId: string; name: string }>> {
  return (
    db
      .select({ profileId: profiles.id, name: profiles.name })
      .from(proposalRelationships)
      // Inner joins: the composite foreign key guarantees the source is a
      // proposal in this decision, and every proposal owns a profile.
      .innerJoin(
        proposals,
        eq(proposals.id, proposalRelationships.sourceProposalId),
      )
      .innerJoin(profiles, eq(profiles.id, proposals.profileId))
      .where(
        and(liveMergeInto(targetProposalId), needsNoAccessException(proposals)),
      )
      .orderBy(proposalRelationships.createdAt, proposalRelationships.id)
  );
}

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
