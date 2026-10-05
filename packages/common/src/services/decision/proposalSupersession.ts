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
} from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalRelationshipType,
  profileRelationships,
  profiles,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import { count as countFn } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  type ProposalReadContext,
  isProposalReadable,
} from './proposalVisibility';

/**
 * What makes a `proposal_relationships` row a live `merged` edge at all. A
 * function rather than a constant so no SQL is built at import time.
 */
const isLiveMergeEdge = (): SQL =>
  and(
    eq(proposalRelationships.relationshipType, ProposalRelationshipType.MERGED),
    isNull(proposalRelationships.deletedAt),
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
 * How many likes each of `targetProfileIds` carries over from the proposals
 * merged into it, keyed by the target proposal's own profile id.
 *
 * A merge records an edge and moves no content, so the likes on a merged-away
 * proposal stay on its profile — which `notSuperseded` then hides from every
 * list, dropping them out of the count entirely. Every read that reports a
 * proposal's like count adds this on top of the proposal's own, so the number
 * covers the whole merged idea rather than only the proposal that survived.
 *
 * Direct sources only, the same set `listContributingProposals` shows: the
 * total a proposal reports is the sum over exactly the contributing ideas its
 * page lists.
 *
 * Likes are summed rather than deduplicated by liker. One person who liked two
 * of the merged proposals counts twice, which is the price of the client's
 * optimistic bump staying honest: it moves the count by one per like and
 * unlike, and collapsing duplicate likers would make the next read disagree
 * with it.
 *
 * Keyed on the target's *profile* rather than its proposal id because that is
 * the id every caller already holds to count the proposal's own likes.
 */
export async function getMergedLikeCounts({
  targetProfileIds,
  db: dbClient = db,
}: {
  targetProfileIds: string[];
  /** A transaction, so the carried-over likes share the caller's snapshot. */
  db?: DbClient;
}): Promise<Map<string, number>> {
  if (targetProfileIds.length === 0) {
    return new Map();
  }

  const sourceProposals = alias(proposals, 'merge_source_proposals');
  const targetProposals = alias(proposals, 'merge_target_proposals');

  const rows = await dbClient
    .select({
      targetProfileId: targetProposals.profileId,
      likes: countFn(),
    })
    .from(proposalRelationships)
    // Inner joins throughout: the composite foreign keys guarantee both ends
    // are proposals of this decision, and every proposal owns a profile.
    .innerJoin(
      targetProposals,
      eq(targetProposals.id, proposalRelationships.targetProposalId),
    )
    .innerJoin(
      sourceProposals,
      eq(sourceProposals.id, proposalRelationships.sourceProposalId),
    )
    .innerJoin(
      profileRelationships,
      and(
        eq(profileRelationships.targetProfileId, sourceProposals.profileId),
        eq(
          profileRelationships.relationshipType,
          ProfileRelationshipType.LIKES,
        ),
      ),
    )
    .where(
      and(
        inArray(targetProposals.profileId, targetProfileIds),
        isLiveMergeEdge(),
        // A deleted or detached source is gone for everyone, its likes with it.
        // Visibility is deliberately not applied: one proposal must not report
        // a different total to an admin than it does on the results page.
        isNull(sourceProposals.deletedAt),
        isNull(sourceProposals.moderationDetachedAt),
      ),
    )
    .groupBy(targetProposals.profileId);

  return new Map(rows.map((row) => [row.targetProfileId, Number(row.likes)]));
}
