import {
  type DbClient,
  and,
  db as defaultDb,
  eq,
  inArray,
} from '@op/db/client';
import { proposalCategories } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { assertProfileAccess } from '../assert';
import { getActivelyFlaggedItemIds } from '../moderation/moderationVisibility';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { getSelectedProposalIds } from './getSelectedProposalIds';
import { isLegacyInstanceData } from './isLegacyInstance';
import { parseProposalData } from './proposalDataSchema';
import type { DecisionInstanceData } from './schemas/instanceData';
import type {
  SelectionCandidate,
  SelectionCandidatesList,
} from './schemas/proposal';
import { buildVoteCountSql } from './voteCountSql';

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
 * per-row TipTap doc payload (`documentContent` / `htmlContent`), the resolved
 * `proposalTemplate`, and the engagement metrics the selection UI never
 * renders. A 5k-candidate set used to fan out 500 concurrency-10 TipTap
 * fetches here and time out before the admin saw a row; the selection table
 * only needs the proposal-data fields (title, budget, category) plus the vote
 * count.
 *
 * Pagination: `newest` / `oldest` keyset on `createdAt + id`. `votes` sorts by
 * a correlated aggregate that can't keyset, so it pages by offset instead —
 * the candidate set is phase-bounded, and manual selection happens after
 * voting closes, so the ordering is stable across pages.
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

  const total = candidateIds.length;
  if (total === 0) {
    return { items: [], total: 0, next: null };
  }

  // Two cursor modes share the opaque `cursor` string: keyset ({ value, id })
  // for the createdAt sorts, offset ({ offset }) for votes. A sort switch on
  // the client changes the query key, so a cursor never crosses modes.
  const decodedKeysetCursor =
    cursor && sortOrder !== 'votes'
      ? decodeCursor<{ value: string | Date; id: string }>(cursor)
      : undefined;
  const offset =
    cursor && sortOrder === 'votes'
      ? decodeCursor<{ offset: number }>(cursor).offset
      : 0;

  const dir: 'asc' | 'desc' = sortOrder === 'oldest' ? 'asc' : 'desc';

  const rawRows = await db.query.proposals.findMany({
    where: {
      RAW: (table) =>
        and(
          inArray(table.id, candidateIds),
          sortOrder === 'votes'
            ? undefined
            : getCursorCondition({
                column: table.createdAt,
                tieBreakerColumn: table.id,
                cursor: decodedKeysetCursor,
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
    ...(sortOrder === 'votes' && offset > 0 && { offset }),
    extras: {
      voteCount: (table, { sql: sqlOp }) =>
        sqlOp<number>`${buildVoteCountSql({ proposalsTable: table, processInstanceId })}`.as(
          'vote_count',
        ),
    },
    orderBy: (table, { asc: ascOp, desc: descOp }) => {
      if (sortOrder === 'votes') {
        return [
          descOp(
            buildVoteCountSql({ proposalsTable: table, processInstanceId }),
          ),
          descOp(table.createdAt),
          descOp(table.id),
        ];
      }
      const directional = dir === 'asc' ? ascOp : descOp;
      return [directional(table.createdAt), directional(table.id)];
    },
  });

  const hasMore = rawRows.length > limit;
  const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;

  const [selectedIds, flaggedIds] = await Promise.all([
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
      isSelected: selectedIds.has(row.id),
      isFlagged: flaggedIds.has(row.id),
      voteCount: Number(row.voteCount ?? 0),
    };
  });

  const next = hasMore
    ? encodeNextCursor({ sortOrder, offset, limit, items })
    : null;

  return { items, total, next };
}

function encodeNextCursor({
  sortOrder,
  offset,
  limit,
  items,
}: {
  sortOrder: 'votes' | 'newest' | 'oldest';
  offset: number;
  limit: number;
  items: SelectionCandidate[];
}): string | null {
  if (sortOrder === 'votes') {
    return encodeCursor<{ offset: number }>({ offset: offset + limit });
  }

  const lastItem = items[items.length - 1];
  const cursorValue = lastItem?.createdAt;
  // `!= null` (not a truthy check) so a falsy-but-valid sort value still
  // produces a cursor instead of silently ending pagination.
  if (!lastItem || cursorValue == null) {
    return null;
  }

  return encodeCursor<{ value: string | Date; id: string }>({
    value: cursorValue,
    id: lastItem.id,
  });
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
