import {
  type DbClient,
  and,
  db as defaultDb,
  eq,
  inArray,
} from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  ProposalStatus,
  proposalCategories,
  proposalReviewAssignments,
} from '@op/db/schema';
import { logger } from '@op/logging';

import { getCategoryReviewersByProposal } from './getCategoryReviewersByProposal';
import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import {
  type AssignableProposal,
  insertReviewAssignments,
} from './insertReviewAssignments';
import type { DecisionInstanceData } from './schemas/instanceData';
import { assertInstancePhase } from './utils/instance';
import { getPhaseReviewSettings, isReviewPhase } from './utils/phaseSettings';

/**
 * What triggered the reconcile, and therefore which proposals to re-diff:
 * a set of proposals directly (a proposal changed its categories), or a
 * category whose scope rows changed (reconcile that category's in-phase
 * proposals).
 */
export type ReconcileAffected =
  | { proposalIds: string[] }
  | { taxonomyTermId: string };

export interface ReconcileReviewAssignmentsInput {
  instanceId: string;
  affected: ReconcileAffected;
  /**
   * Run the reconcile inside a caller-supplied transaction — used by the
   * `setProposalCategories` callers so a category change and its assignment
   * fix-up commit atomically. Defaults to the shared client.
   */
  db?: DbClient;
}

export type ReconcileReviewAssignmentsResult =
  | { skipped: string }
  | { inserted: number; deleted: number; proposalCount: number };

/** Only `pending` assignments may be pruned (§3) — see {@link reconcileReviewAssignments}. */
const PRUNABLE_STATUS = ProposalReviewAssignmentStatus.PENDING;

/**
 * Declarative, on-change reconcile of `by_category` review assignments for the
 * proposals touched by a category-related change (a scope-row add/remove, or a
 * proposal's category set changing) mid-phase.
 *
 * For each affected proposal the expected reviewer set is its scope rows ⨝ its
 * current categories, intersected with the eligible reviewers
 * (`getEligibleReviewerProfileIds`, Decision 7 fail-closed) and minus the
 * author. The diff against the existing assignment rows is applied as:
 *   - INSERT the newly-justified assignments (add-only, `onConflictDoNothing`);
 *   - DELETE existing-but-no-longer-expected assignments — but ONLY status
 *     `pending` (§3). A non-pending assignment owns `proposalReviews` /
 *     `proposal_review_requests` rows that cascade-delete with it, so removal
 *     never retracts submitted or in-flight work; it only stops future work.
 *
 * A no-op (logged skip) unless the instance is published, in a review-capable
 * phase, with `scope === 'by_category'` and a `full_coverage` policy. The
 * proposal universe is the phase's inbound-transition attachment set (matching
 * generation/backfill), so inserts carry the same `assignedProposalHistoryId`
 * and proposals not in the phase are ignored.
 */
export async function reconcileReviewAssignments({
  instanceId,
  affected,
  db = defaultDb,
}: ReconcileReviewAssignmentsInput): Promise<ReconcileReviewAssignmentsResult> {
  const skip = (reason: string): ReconcileReviewAssignmentsResult => {
    logger.info('reconcileReviewAssignments: skipped', { instanceId, reason });
    return { skipped: reason };
  };

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    return skip('instance not found');
  }
  if (instance.status !== ProcessStatus.PUBLISHED) {
    return skip(`instance is not published (status: ${instance.status})`);
  }
  if (!instance.profileId) {
    return skip('instance has no profileId');
  }
  const currentPhaseId = instance.currentStateId;
  if (!currentPhaseId) {
    return skip('instance has no current phase');
  }

  const instanceData = instance.instanceData as DecisionInstanceData;
  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });
  if (!isReviewPhase(currentPhase)) {
    return skip('current phase is not review-capable');
  }
  const reviewSettings = getPhaseReviewSettings(instanceData, currentPhaseId);

  // Reconcile only runs under `full_coverage`: its expected set is the whole
  // scope⨝eligibility intersection, so under `single_reviewer` it would fan out
  // full-coverage inserts, and under `none` it would create the very rows the
  // policy exists to suppress.
  if (reviewSettings.policy !== 'full_coverage') {
    return skip(`current phase policy is ${reviewSettings.policy}`);
  }
  if (reviewSettings.scope !== 'by_category') {
    return skip('current phase scope is not by_category');
  }

  // Most recent transition INTO the current phase — its attachment set defines
  // the proposal universe (and the assigned history ids), exactly as
  // generation/backfill see it.
  const inboundTransition = await db.query.stateTransitionHistory.findFirst({
    where: { processInstanceId: instanceId, toStateId: currentPhaseId },
    orderBy: { transitionedAt: 'desc' },
    columns: { id: true },
  });
  if (!inboundTransition) {
    return skip('current phase has no inbound transition');
  }

  const attachedProposals = await db.query.decisionTransitionProposals.findMany(
    {
      where: {
        transitionHistoryId: inboundTransition.id,
        proposal: {
          status: { ne: ProposalStatus.DRAFT },
          deletedAt: { isNull: true },
          moderationDetachedAt: { isNull: true },
        },
      },
      columns: { proposalId: true, proposalHistoryId: true },
      with: { proposal: { columns: { submittedByProfileId: true } } },
    },
  );

  const attachedByProposalId = new Map(
    attachedProposals.map((row) => [row.proposalId, row]),
  );
  const attachedIds = [...attachedByProposalId.keys()];

  const affectedIds = await resolveAffectedProposalIds({
    db,
    affected,
    attachedByProposalId,
    attachedIds,
  });

  if (affectedIds.length === 0) {
    return { inserted: 0, deleted: 0, proposalCount: 0 };
  }

  const [scopedByProposal, eligibleReviewerProfileIds, existingRows] =
    await Promise.all([
      getCategoryReviewersByProposal({
        db,
        instanceId,
        phaseId: currentPhaseId,
        proposalIds: affectedIds,
      }),
      getEligibleReviewerProfileIds({ decisionProfileId: instance.profileId }),
      db.query.proposalReviewAssignments.findMany({
        where: {
          processInstanceId: instanceId,
          phaseId: currentPhaseId,
          proposalId: { in: affectedIds },
        },
        columns: {
          id: true,
          proposalId: true,
          reviewerProfileId: true,
          status: true,
        },
      }),
    ]);

  const eligibleSet = new Set(eligibleReviewerProfileIds);

  const existingByProposalId = new Map<string, typeof existingRows>();
  for (const row of existingRows) {
    const bucket = existingByProposalId.get(row.proposalId) ?? [];
    bucket.push(row);
    existingByProposalId.set(row.proposalId, bucket);
  }

  const assignableProposals: AssignableProposal[] = affectedIds.map(
    (proposalId) => {
      const attached = attachedByProposalId.get(proposalId)!;
      const scoped = scopedByProposal.get(proposalId) ?? new Set<string>();
      return {
        proposalId,
        submittedByProfileId: attached.proposal.submittedByProfileId,
        assignedProposalHistoryId: attached.proposalHistoryId,
        reviewerProfileIds: [...scoped].filter((id) => eligibleSet.has(id)),
      };
    },
  );

  const inserted = await insertReviewAssignments({
    db,
    instanceId,
    phaseId: currentPhaseId,
    assignableProposals,
  });

  // Prune existing-but-no-longer-expected assignments — pending only (§3). Self
  // is never in the expected set (insertReviewAssignments excludes it), so an
  // author never has a prunable self-assignment to begin with.
  const idsToDelete: string[] = [];
  for (const proposal of assignableProposals) {
    const expected = new Set(
      proposal.reviewerProfileIds.filter(
        (id) => id !== proposal.submittedByProfileId,
      ),
    );
    for (const row of existingByProposalId.get(proposal.proposalId) ?? []) {
      if (
        row.status === PRUNABLE_STATUS &&
        !expected.has(row.reviewerProfileId)
      ) {
        idsToDelete.push(row.id);
      }
    }
  }

  let deleted = 0;
  if (idsToDelete.length > 0) {
    const deletedRows = await db
      .delete(proposalReviewAssignments)
      .where(inArray(proposalReviewAssignments.id, idsToDelete))
      .returning({ id: proposalReviewAssignments.id });
    deleted = deletedRows.length;
  }

  return { inserted, deleted, proposalCount: affectedIds.length };
}

/**
 * Narrows the reconcile to the proposals the triggering change actually
 * touched, always within the phase's attachment set: a direct proposal set
 * (recategorization), or the in-phase proposals tagged with a changed category
 * (a scope-row add/remove).
 */
async function resolveAffectedProposalIds({
  db,
  affected,
  attachedByProposalId,
  attachedIds,
}: {
  db: DbClient;
  affected: ReconcileAffected;
  attachedByProposalId: Map<string, unknown>;
  attachedIds: string[];
}): Promise<string[]> {
  if ('proposalIds' in affected) {
    return affected.proposalIds.filter((id) => attachedByProposalId.has(id));
  }

  if (attachedIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ proposalId: proposalCategories.proposalId })
    .from(proposalCategories)
    .where(
      and(
        eq(proposalCategories.taxonomyTermId, affected.taxonomyTermId),
        inArray(proposalCategories.proposalId, attachedIds),
      ),
    );

  return [...new Set(rows.map((row) => row.proposalId))];
}
