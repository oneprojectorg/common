import {
  type Column,
  type DbClient,
  type SQL,
  and,
  db,
  eq,
  inArray,
  isNull,
  notExists,
  sql,
} from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalRelationshipType,
  profileRelationships,
  profiles,
  proposalRelationships,
  proposals,
} from '@op/db/schema';

import {
  type ProposalReadContext,
  isProposalReadable,
  isReadableByEveryone,
} from './proposalVisibility';

/**
 * A `merged` edge that has not been unmerged. Built lazily, not as a constant:
 * module-scope SQL runs before a test's `@op/db/client` mock is in place.
 */
const isLiveMergeEdge = (): SQL =>
  and(
    eq(proposalRelationships.relationshipType, ProposalRelationshipType.MERGED),
    isNull(proposalRelationships.deletedAt),
  )!;

/**
 * Join condition for the live `merged` edge leading away from a proposal. The
 * partial unique index allows at most one, so a `leftJoin` cannot fan out.
 */
export const liveMergeEdgeFrom = (sourceProposalId: Column | SQL): SQL =>
  and(
    eq(proposalRelationships.sourceProposalId, sourceProposalId),
    isLiveMergeEdge(),
  )!;

/** A live `merged` edge pointing *at* `targetProposalId`. */
const liveMergeInto = (targetProposalId: string): SQL =>
  and(
    eq(proposalRelationships.targetProposalId, targetProposalId),
    isLiveMergeEdge(),
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
    isLiveMergeEdge(),
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
 *
 * Gated on `isProposalReadable`, the same predicate `listContributingProposals`
 * applies to the far end of every edge — so the comments that carry over come
 * from exactly the proposals the "Contributing ideas" section lists, including
 * the hidden ones an admin or the proposal's own authors can still open.
 */
export async function getVisibleMergedSourceProfiles({
  targetProposalId,
  readContext,
}: {
  targetProposalId: string;
  readContext: ProposalReadContext;
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
        and(
          liveMergeInto(targetProposalId),
          isProposalReadable(proposals, readContext),
        ),
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

/**
 * Likes carried over from every proposal merged into each of `targetProfileIds`,
 * directly or through a chain, for callers to add to the proposal's own count.
 * Only sources readable by everyone count, so no viewer sees engagement from a
 * proposal they cannot open; likes are summed, not counted per liker.
 */
export async function getMergedLikeCounts({
  targetProfileIds,
  db: dbClient = db,
}: {
  targetProfileIds: string[];
  db?: DbClient;
}): Promise<Map<string, number>> {
  if (targetProfileIds.length === 0) {
    return new Map();
  }

  // `UNION`, not `UNION ALL`: it still terminates if a race leaves a cycle.
  const rows = await dbClient.execute<{
    target_profile_id: string;
    likes: number;
  }>(sql`
    WITH RECURSIVE merged_into (target_profile_id, proposal_id) AS (
      SELECT ${proposals.profileId}, ${proposals.id}
      FROM ${proposals}
      WHERE ${inArray(proposals.profileId, targetProfileIds)}
      UNION
      SELECT merged_into.target_profile_id, ${proposalRelationships.sourceProposalId}
      FROM ${proposalRelationships}
      JOIN merged_into
        ON ${proposalRelationships.targetProposalId} = merged_into.proposal_id
      WHERE ${isLiveMergeEdge()}
    )
    SELECT merged_into.target_profile_id, count(*)::int AS likes
    FROM merged_into
    JOIN ${proposals} ON ${proposals.id} = merged_into.proposal_id
    JOIN ${profileRelationships}
      ON ${profileRelationships.targetProfileId} = ${proposals.profileId}
      AND ${eq(profileRelationships.relationshipType, ProfileRelationshipType.LIKES)}
    WHERE ${proposals.profileId} <> merged_into.target_profile_id
      AND ${isReadableByEveryone(proposals)}
    GROUP BY merged_into.target_profile_id
  `);

  return new Map(rows.map((row) => [row.target_profile_id, row.likes]));
}
