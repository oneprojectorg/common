import {
  type DbClient,
  and,
  db as defaultDb,
  eq,
  inArray,
  sql,
} from '@op/db/client';
import {
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import {
  CommonError,
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { assertProfileAccess } from '../assert';
import { getActivelyFlaggedItemIds } from '../moderation/moderationVisibility';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { getSelectedProposalIds } from './getSelectedProposalIds';
import { isLegacyInstanceData } from './isLegacyInstance';
import { parseProposalData } from './proposalDataSchema';
import type { DecisionInstanceData } from './schemas/instanceData';
import type {
  SelectionCandidate,
  SelectionCandidatesList,
} from './schemas/proposal';

interface ListSelectionCandidatesInput {
  processInstanceId: string;
  user: User;
  /** Filter via the canonical `proposalCategories` join, not `proposalData.category`. */
  categoryId?: string;
  /**
   * `votes` is the default for the final-phase manual selection so admins see
   * highest-voted proposals first. `newest`/`oldest` retain the prior behavior
   * for callers that still want a createdAt sort.
   */
  sortOrder?: 'votes' | 'newest' | 'oldest';
  /** Cursor returned by a prior page's `next`; opaque to callers. */
  cursor?: string | null;
  /** Max items in this page (1–100, default 50). */
  limit?: number;
  db?: DbClient;
}

/**
 * Admin-gated. Lists proposals eligible to be manually selected into the current
 * phase — i.e. the proposals that belong to the previous phase's membership.
 * Returns an empty list when there is no previous phase (initial or legacy).
 *
 * The response uses the lean {@link SelectionCandidate} schema: it omits the
 * per-row TipTap doc payload (`documentContent` / `htmlContent`) and the
 * resolved `proposalTemplate`. A 5k-candidate set used to fan out 500
 * concurrency-10 TipTap fetches here and time out before the admin saw a
 * row; the selection UI only needs the proposal-data fields (title, budget,
 * category) plus the engagement metrics it already shows.
 *
 * Pagination: keyset on `createdAt + id` for the `newest` / `oldest` sorts.
 * `votes` is single-page because the per-proposal vote count is a correlated
 * subquery — it can drive the sort but it can't keyset.
 */
export async function listSelectionCandidates({
  processInstanceId,
  user,
  categoryId,
  sortOrder = 'votes',
  cursor,
  limit = 50,
  db = defaultDb,
}: ListSelectionCandidatesInput): Promise<SelectionCandidatesList> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  const previousPhaseId = resolvePreviousPhaseId(instance);
  if (!previousPhaseId) {
    return { items: [], total: 0, next: null };
  }

  let categoryProposalIds: Set<string> | undefined;
  if (categoryId) {
    const rows = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));
    if (rows.length === 0) {
      return { items: [], total: 0, next: null };
    }
    categoryProposalIds = new Set(rows.map((r) => r.proposalId));
  }

  const phaseCandidateIds = await getProposalIdsForPhase({
    instance,
    phaseId: previousPhaseId,
    db,
  });

  const candidateIds = categoryProposalIds
    ? phaseCandidateIds.filter((id) => categoryProposalIds.has(id))
    : phaseCandidateIds;

  if (candidateIds.length === 0) {
    return { items: [], total: 0, next: null };
  }

  // The cursor encodes the createdAt + id of the last row from the previous
  // page; `getCursorCondition` turns that into the next-page predicate. Votes
  // is a correlated subquery so it can drive the sort but can't keyset — we
  // return a single page for that mode (next: null).
  const decodedCursor = cursor
    ? decodeCursor<{ value: string | Date; id: string }>(cursor)
    : undefined;

  const dir: 'asc' | 'desc' = sortOrder === 'oldest' ? 'asc' : 'desc';

  // Vote-count correlated subquery: scoped to `processInstanceId` so
  // cross-instance ballots can't inflate counts.
  const voteCountExpr = (t: typeof proposals) =>
    sql<number>`(
      SELECT COUNT(*)::int FROM ${decisionsVoteSubmissions}
      INNER JOIN ${decisionsVoteProposals}
        ON ${decisionsVoteProposals.voteSubmissionId} = ${decisionsVoteSubmissions.id}
      WHERE ${decisionsVoteProposals.proposalId} = ${t.id}
      AND ${decisionsVoteSubmissions.processInstanceId} = ${processInstanceId}
    )`;

  const [rawRows, countResult] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        RAW: (table) =>
          and(
            inArray(table.id, candidateIds),
            sortOrder === 'votes'
              ? undefined
              : getCursorCondition({
                  column: table.createdAt,
                  tieBreakerColumn: table.id,
                  cursor: decodedCursor,
                  direction: dir,
                }),
          )!,
      },
      with: {
        submittedBy: {
          with: {
            avatarImage: true,
            profileUsers: {
              columns: {},
              with: { authUser: { columns: { isAnonymous: true } } },
            },
          },
        },
        profile: true,
      },
      // Fetch one extra to detect whether a next page exists.
      limit: limit + 1,
      extras: {
        voteCount: (table, { sql: sqlOp }) =>
          sqlOp<number>`${voteCountExpr(table)}`.as('vote_count'),
      },
      orderBy: (table, { asc: ascOp, desc: descOp }) => {
        if (sortOrder === 'votes') {
          return [
            descOp(voteCountExpr(table)),
            descOp(table.createdAt),
            descOp(table.id),
          ];
        }
        const directional = dir === 'asc' ? ascOp : descOp;
        return [directional(table.createdAt), directional(table.id)];
      },
    }),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(inArray(proposals.id, candidateIds)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const hasMore = rawRows.length > limit;
  const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;

  const profileIds = pageRows
    .map((p) => p.profileId)
    .filter((id): id is string => Boolean(id));

  const [relationshipData, selectedIds, flaggedIds] = await Promise.all([
    getProposalRelationshipData({ profileIds }),
    getSelectedProposalIds(processInstanceId),
    getActivelyFlaggedItemIds(
      'proposal',
      pageRows.map((p) => p.id),
    ),
  ]);

  const items: SelectionCandidate[] = pageRows.map((row) => {
    const rawSubmittedBy = Array.isArray(row.submittedBy)
      ? row.submittedBy[0]
      : row.submittedBy;
    const submittedBy = rawSubmittedBy
      ? (() => {
          const { profileUsers, ...author } = rawSubmittedBy;
          return {
            ...author,
            isAnonymous: Boolean(
              profileUsers?.some(
                (pu: { authUser: { isAnonymous: boolean } | null }) =>
                  pu.authUser?.isAnonymous,
              ),
            ),
          };
        })()
      : rawSubmittedBy;
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const relationshipInfo = relationshipData.get(row.profileId);

    return {
      id: row.id,
      processInstanceId: row.processInstanceId,
      proposalData: parseProposalData(row.proposalData),
      status: row.status,
      visibility: row.visibility,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      profileId: row.profileId,
      submittedBy,
      profile,
      likesCount: relationshipInfo?.likesCount || 0,
      followersCount: relationshipInfo?.followersCount || 0,
      isLikedByUser: relationshipInfo?.isLikedByUser || false,
      isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
      commentsCount: relationshipInfo?.commentsCount || 0,
      isSelected: selectedIds.has(row.id),
      isFlagged: flaggedIds.has(row.id),
      voteCount: Number(row.voteCount ?? 0),
    };
  });

  // Votes is single-page (correlated subquery can't keyset); for the other
  // sorts, emit the cursor of the last row when there's another page.
  const lastItem = items[items.length - 1];
  const next =
    sortOrder !== 'votes' && hasMore && lastItem?.createdAt
      ? encodeCursor<{ value: string | Date; id: string }>({
          value: lastItem.createdAt,
          id: lastItem.id,
        })
      : null;

  return { items, total, next };
}

function resolvePreviousPhaseId(instance: {
  instanceData: unknown;
  currentStateId: string | null;
}): string | undefined {
  if (isLegacyInstanceData(instance.instanceData)) {
    return undefined;
  }

  const currentStateId = instance.currentStateId;
  if (!currentStateId) {
    return undefined;
  }

  const phases = (instance.instanceData as DecisionInstanceData | null)?.phases;
  if (!phases || phases.length === 0) {
    return undefined;
  }

  const currentIndex = phases.findIndex((p) => p.phaseId === currentStateId);
  if (currentIndex <= 0) {
    return undefined;
  }

  return phases[currentIndex - 1]?.phaseId;
}
