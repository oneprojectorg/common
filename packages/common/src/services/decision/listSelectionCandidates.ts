import { type DbClient, db as defaultDb, eq, inArray } from '@op/db/client';
import { proposalCategories } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
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
  /** Max rows to return (1–100, default 50). */
  limit?: number;
  db?: DbClient;
}

/**
 * Admin-gated. Lists proposals eligible to be manually selected into the current
 * phase — i.e. the proposals that belong to the previous phase's membership.
 * Returns an empty list when there is no previous phase (initial or legacy).
 *
 * Returns a single capped page plus the full candidate `total`. The manual
 * selection UI only ever renders the first page, so there's no cursor — the
 * `total` lets the frontend show how many candidates exist without loading
 * them all.
 *
 * The response uses the lean {@link SelectionCandidate} schema: it omits the
 * per-row TipTap doc payload (`documentContent` / `htmlContent`), the resolved
 * `proposalTemplate`, and the engagement metrics the selection UI never
 * renders. A 5k-candidate set used to fan out 500 concurrency-10 TipTap
 * fetches here and time out before the admin saw a row; the selection table
 * only needs the proposal-data fields (title, budget, category) plus the vote
 * count.
 */
export async function listSelectionCandidates({
  processInstanceId,
  user,
  categoryId,
  sortOrder = 'votes',
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
    return { items: [], total: 0 };
  }

  let categoryProposalIds: Set<string> | undefined;
  if (categoryId) {
    const rows = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));
    if (rows.length === 0) {
      return { items: [], total: 0 };
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
    return { items: [], total: 0 };
  }

  const dir: 'asc' | 'desc' = sortOrder === 'oldest' ? 'asc' : 'desc';

  const rawRows = await db.query.proposals.findMany({
    where: {
      RAW: (table) => inArray(table.id, candidateIds),
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
    limit,
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

  const [selectedIds, flaggedIds] = await Promise.all([
    getSelectedProposalIds(processInstanceId),
    getActivelyFlaggedItemIds(
      'proposal',
      rawRows.map((p) => p.id),
    ),
  ]);

  const items: SelectionCandidate[] = rawRows.map((row) => {
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

  return { items, total };
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
