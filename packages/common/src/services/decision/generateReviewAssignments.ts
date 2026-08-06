import { db } from '@op/db/client';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import { getCategoryReviewersByProposal } from './getCategoryReviewersByProposal';
import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import {
  type AssignableProposal,
  insertReviewAssignments,
} from './insertReviewAssignments';
import { pickSingleReviewerAssignments } from './pickSingleReviewerAssignments';
import type { DecisionInstanceData } from './schemas/instanceData';
import { getPhaseReviewSettings } from './utils/phaseSettings';

export interface GenerateReviewAssignmentsInput {
  instanceId: string;
  phaseId: string;
  selectedProposalIds: string[];
  transitionHistoryId: string;
}

interface SelectedProposal {
  id: string;
  submittedByProfileId: string | null;
}

type ZeroCandidateReason =
  | 'no_eligible_reviewers'
  | 'category_has_no_eligible_reviewers'
  | 'uncategorized';

/** A proposal's candidate reviewers, author already excluded. */
interface CandidateProposal extends AssignableProposal {
  /** Read only when the set is empty; scopes without a specific reason omit it. */
  zeroCandidateReason?: ZeroCandidateReason;
}

/**
 * Generate review assignment rows for proposals entering a review-capable phase.
 *
 * Only members with the REVIEW capability on the `decisions` access zone are
 * eligible. Reviewers are never assigned their own proposals.
 *
 * Scope `all`: every eligible reviewer is assigned every proposal. Scope
 * `by_category`: each proposal is assigned only the eligible reviewers whose
 * scope rows cover its categories. Insert-only — never prunes.
 *
 * The scope builds the candidate set; the policy decides how much of it is
 * written — `full_coverage` all of it, `single_reviewer` one balanced pick
 * (`pickSingleReviewerAssignments`).
 */
export async function generateReviewAssignments({
  instanceId,
  phaseId,
  selectedProposalIds,
  transitionHistoryId,
}: GenerateReviewAssignmentsInput): Promise<void> {
  if (selectedProposalIds.length === 0) {
    return;
  }

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new CommonError(
      `generateReviewAssignments: instance ${instanceId} not found`,
    );
  }

  const decisionProfileId = instance.profileId;

  if (!decisionProfileId) {
    logger.error('generateReviewAssignments: instance has no profileId', {
      instanceId,
    });
    return;
  }

  const [selectedProposals, reviewerProfileIds, transitionProposalRows] =
    await Promise.all([
      db.query.proposals.findMany({
        where: { id: { in: selectedProposalIds } },
        columns: { id: true, submittedByProfileId: true },
      }),

      getEligibleReviewerProfileIds({ decisionProfileId }),

      // The proposal history snapshots captured during the phase transition.
      db.query.decisionTransitionProposals.findMany({
        where: {
          transitionHistoryId,
          proposalId: { in: selectedProposalIds },
        },
        columns: { proposalId: true, proposalHistoryId: true },
      }),
    ]);

  const historyByProposalId = new Map(
    transitionProposalRows.map((r) => [r.proposalId, r.proposalHistoryId]),
  );

  const { scope, policy } = getPhaseReviewSettings(
    instance.instanceData as DecisionInstanceData,
    phaseId,
  );

  const candidateProposals =
    scope === 'by_category'
      ? await buildByCategoryProposals({
          instanceId,
          phaseId,
          selectedProposalIds,
          selectedProposals,
          eligibleReviewerProfileIds: reviewerProfileIds,
          historyByProposalId,
        })
      : buildAllScopeProposals({
          selectedProposals,
          eligibleReviewerProfileIds: reviewerProfileIds,
          historyByProposalId,
        });

  warnUncoverableProposals({ instanceId, phaseId, candidateProposals });

  const assignableProposals =
    policy === 'single_reviewer'
      ? await applySingleReviewerPolicy({
          instanceId,
          phaseId,
          candidateProposals,
        })
      : candidateProposals;

  await insertReviewAssignments({
    instanceId,
    phaseId,
    assignableProposals,
  });
}

/**
 * Narrows the candidate sets to one reviewer per proposal, seeded from the
 * phase's existing rows — which double as the load counters and the
 * idempotency guard for a re-run.
 *
 * The read and the downstream insert need no transaction: generation only runs
 * on the winning side of a phase transition, which serializes on a
 * `SELECT ... FOR UPDATE` of the instance.
 */
async function applySingleReviewerPolicy({
  instanceId,
  phaseId,
  candidateProposals,
}: {
  instanceId: string;
  phaseId: string;
  candidateProposals: AssignableProposal[];
}): Promise<AssignableProposal[]> {
  const existingAssignments = await db.query.proposalReviewAssignments.findMany(
    {
      where: { processInstanceId: instanceId, phaseId },
      columns: { proposalId: true, reviewerProfileId: true },
    },
  );

  const { assignableProposals, alreadyCoveredProposalIds } =
    pickSingleReviewerAssignments({
      assignableProposals: candidateProposals,
      existingAssignments,
    });

  if (alreadyCoveredProposalIds.length > 0) {
    logger.info(
      'generateReviewAssignments: skipped proposals already covered in this phase',
      {
        instanceId,
        phaseId,
        skippedCount: alreadyCoveredProposalIds.length,
        proposalIds: alreadyCoveredProposalIds,
      },
    );
  }

  return assignableProposals;
}

/**
 * One warning per uncoverable proposal, for every scope × policy combination.
 * Reads the candidate sets, not the policy output — a proposal the policy
 * empties on purpose (already covered) is not a gap.
 */
function warnUncoverableProposals({
  instanceId,
  phaseId,
  candidateProposals,
}: {
  instanceId: string;
  phaseId: string;
  candidateProposals: CandidateProposal[];
}): void {
  for (const proposal of candidateProposals) {
    if (proposal.reviewerProfileIds.length > 0) {
      continue;
    }

    logger.warn('generateReviewAssignments: proposal has zero reviewers', {
      instanceId,
      phaseId,
      proposalId: proposal.proposalId,
      reason: proposal.zeroCandidateReason ?? 'no_eligible_reviewers',
    });
  }
}

/** Every eligible reviewer, minus the proposal's own author. */
function buildAllScopeProposals({
  selectedProposals,
  eligibleReviewerProfileIds,
  historyByProposalId,
}: {
  selectedProposals: SelectedProposal[];
  eligibleReviewerProfileIds: string[];
  historyByProposalId: Map<string, string>;
}): CandidateProposal[] {
  return selectedProposals.map((proposal) => ({
    proposalId: proposal.id,
    submittedByProfileId: proposal.submittedByProfileId,
    assignedProposalHistoryId: historyByProposalId.get(proposal.id) ?? null,
    reviewerProfileIds: eligibleReviewerProfileIds.filter(
      (id) => id !== proposal.submittedByProfileId,
    ),
  }));
}

/**
 * Scope rows covering the proposal's categories ∩ eligible reviewers, minus
 * the author. A proposal nobody covers is never blocked: it carries the reason
 * for the warning and proceeds with an empty set.
 */
async function buildByCategoryProposals({
  instanceId,
  phaseId,
  selectedProposalIds,
  selectedProposals,
  eligibleReviewerProfileIds,
  historyByProposalId,
}: {
  instanceId: string;
  phaseId: string;
  selectedProposalIds: string[];
  selectedProposals: SelectedProposal[];
  eligibleReviewerProfileIds: string[];
  historyByProposalId: Map<string, string>;
}): Promise<CandidateProposal[]> {
  const [scopedByProposal, categorizedRows] = await Promise.all([
    getCategoryReviewersByProposal({
      instanceId,
      phaseId,
      proposalIds: selectedProposalIds,
    }),
    db.query.proposalCategories.findMany({
      where: { proposalId: { in: selectedProposalIds } },
      columns: { proposalId: true },
    }),
  ]);

  const categorizedProposalIds = new Set(
    categorizedRows.map((row) => row.proposalId),
  );
  const eligibleSet = new Set(eligibleReviewerProfileIds);

  return selectedProposals.map((proposal) => {
    const scoped = scopedByProposal.get(proposal.id) ?? new Set<string>();
    const reviewerProfileIds = [...scoped].filter(
      (id) => eligibleSet.has(id) && id !== proposal.submittedByProfileId,
    );

    return {
      proposalId: proposal.id,
      submittedByProfileId: proposal.submittedByProfileId,
      assignedProposalHistoryId: historyByProposalId.get(proposal.id) ?? null,
      reviewerProfileIds,
      zeroCandidateReason: categorizedProposalIds.has(proposal.id)
        ? 'category_has_no_eligible_reviewers'
        : 'uncategorized',
    };
  });
}
