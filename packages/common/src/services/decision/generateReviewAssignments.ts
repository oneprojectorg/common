import { db } from '@op/db/client';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import { applyCoveragePolicy } from './applyCoveragePolicy';
import { getCategoryReviewersByProposal } from './getCategoryReviewersByProposal';
import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import {
  type AssignableProposal,
  insertReviewAssignments,
} from './insertReviewAssignments';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ReviewsScope } from './schemas/types';
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
 * The scope produces the per-proposal candidate set; the policy decides how much
 * of it is written. `full_coverage` inserts the whole set; `single_reviewer`
 * narrows it to one balanced, deterministic pick per proposal
 * (`applyCoveragePolicy`), skipping proposals already covered in this phase.
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
      : selectedProposals.map((proposal) => ({
          proposalId: proposal.id,
          submittedByProfileId: proposal.submittedByProfileId,
          assignedProposalHistoryId:
            historyByProposalId.get(proposal.id) ?? null,
          reviewerProfileIds,
        }));

  const assignableProposals =
    policy === 'single_reviewer'
      ? await applySingleReviewerPolicy({
          instanceId,
          phaseId,
          scope,
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
 * phase's existing assignment rows — which serve double duty as the load
 * counters and the idempotency guard for a re-run.
 *
 * Only `scope: 'all'` warns here: `by_category` already warned upstream with a
 * more specific reason for exactly the same set of uncoverable proposals.
 */
async function applySingleReviewerPolicy({
  instanceId,
  phaseId,
  scope,
  candidateProposals,
}: {
  instanceId: string;
  phaseId: string;
  scope: ReviewsScope;
  candidateProposals: AssignableProposal[];
}): Promise<AssignableProposal[]> {
  const existingAssignments = await db.query.proposalReviewAssignments.findMany(
    {
      where: { processInstanceId: instanceId, phaseId },
      columns: { proposalId: true, reviewerProfileId: true },
    },
  );

  const { assignableProposals, zeroCandidateProposalIds } = applyCoveragePolicy(
    {
      assignableProposals: candidateProposals,
      existingAssignments,
    },
  );

  if (scope === 'all') {
    for (const proposalId of zeroCandidateProposalIds) {
      logger.warn('generateReviewAssignments: proposal has zero reviewers', {
        instanceId,
        phaseId,
        proposalId,
        reason: 'no_eligible_reviewers',
      });
    }
  }

  return assignableProposals;
}

/**
 * Builds per-proposal reviewer sets for the `by_category` scope: scope rows
 * covering the proposal's categories ∩ eligible reviewers. Proposals that end
 * up with zero reviewers (uncategorized, or a category with no eligible scoped
 * reviewer) are logged but still proceed with an empty set — never blocked.
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
}): Promise<AssignableProposal[]> {
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
    const reviewerProfileIds = [...scoped].filter((id) => eligibleSet.has(id));

    // Mirror the downstream self-review exclusion to detect a truly
    // uncoverable proposal.
    const coveringReviewers = reviewerProfileIds.filter(
      (id) => id !== proposal.submittedByProfileId,
    );

    if (coveringReviewers.length === 0) {
      logger.warn('generateReviewAssignments: proposal has zero reviewers', {
        instanceId,
        phaseId,
        proposalId: proposal.id,
        reason: categorizedProposalIds.has(proposal.id)
          ? 'category_has_no_eligible_reviewers'
          : 'uncategorized',
      });
    }

    return {
      proposalId: proposal.id,
      submittedByProfileId: proposal.submittedByProfileId,
      assignedProposalHistoryId: historyByProposalId.get(proposal.id) ?? null,
      reviewerProfileIds,
    };
  });
}
