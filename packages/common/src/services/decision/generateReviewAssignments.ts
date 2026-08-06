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
      : selectedProposals.map((proposal) => ({
          proposalId: proposal.id,
          submittedByProfileId: proposal.submittedByProfileId,
          assignedProposalHistoryId:
            historyByProposalId.get(proposal.id) ?? null,
          reviewerProfileIds: reviewerProfileIds.filter(
            (id) => id !== proposal.submittedByProfileId,
          ),
        }));

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

  return pickSingleReviewerAssignments({
    assignableProposals: candidateProposals,
    existingAssignments,
  });
}

/**
 * Scope rows covering the proposal's categories ∩ eligible reviewers, minus
 * the author. A proposal nobody covers proceeds with an empty set — never
 * blocked.
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
  const scopedByProposal = await getCategoryReviewersByProposal({
    instanceId,
    phaseId,
    proposalIds: selectedProposalIds,
  });

  const eligibleSet = new Set(eligibleReviewerProfileIds);

  return selectedProposals.map((proposal) => {
    const scoped = scopedByProposal.get(proposal.id) ?? new Set<string>();

    return {
      proposalId: proposal.id,
      submittedByProfileId: proposal.submittedByProfileId,
      assignedProposalHistoryId: historyByProposalId.get(proposal.id) ?? null,
      reviewerProfileIds: [...scoped].filter(
        (id) => eligibleSet.has(id) && id !== proposal.submittedByProfileId,
      ),
    };
  });
}
