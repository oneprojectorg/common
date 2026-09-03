import { and, count, db, eq, inArray } from '@op/db/client';
import {
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getCategoriesByProposalIds } from './listProposalsWithReviewAggregates';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { resolveProposalTitle } from './resolveProposalTitle';
import {
  type ReviewerAssignments,
  reviewerAssignmentsSchema,
} from './schemas/adminDecisionInstance';
import type { InstancePhaseRef } from './schemas/instance';
import { assertInstancePhase } from './utils/instance';

/**
 * One reviewer's queue for a phase: the header identity, the progress totals
 * and the assignment cards with their previews.
 */
export async function getReviewerAssignments({
  user,
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: InstancePhaseRef & {
  user: User;
  reviewerProfileId: string;
}): Promise<ReviewerAssignments> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  // Picks the fragment names the document fetch asks for, so it has to land
  // before that fetch starts.
  const proposalTemplatePromise = resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

  const [reviewer, assignments] = await Promise.all([
    db.query.profiles.findFirst({
      where: { id: reviewerProfileId },
      columns: { id: true, name: true, slug: true, email: true },
    }),
    // Scoped in SQL: this screen never reads another reviewer's rows.
    db.query.proposalReviewAssignments.findMany({
      where: {
        processInstanceId,
        phaseId,
        reviewerProfileId,
        // Unreachable even to admins (see detachProposalForModeration);
        // assignments made before the detach would otherwise leak it.
        proposal: {
          deletedAt: { isNull: true },
          moderationDetachedAt: { isNull: true },
        },
      },
      with: {
        reviews: { columns: { state: true, submittedAt: true } },
        proposal: {
          columns: { id: true, proposalData: true },
          with: {
            profile: { columns: { name: true } },
            submittedBy: { columns: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    }),
  ]);

  const proposalIds = [
    ...new Set(assignments.map((assignment) => assignment.proposalId)),
  ];

  const proposalTemplate = await proposalTemplatePromise;

  const [
    eligibleProfileIds,
    categoriesByProposalId,
    reviewedCountByProposalId,
    documentContentMap,
  ] = await Promise.all([
    instance.profileId
      ? getEligibleReviewerProfileIds({ decisionProfileId: instance.profileId })
      : Promise.resolve<string[]>([]),
    getCategoriesByProposalIds(proposalIds),
    getReviewedCountByProposalId({ processInstanceId, phaseId, proposalIds }),
    getProposalDocumentsContent(
      [
        ...new Map(
          assignments.map((assignment) => [
            assignment.proposal.id,
            assignment.proposal,
          ]),
        ).values(),
      ].map((proposal) => ({
        id: proposal.id,
        proposalData: proposal.proposalData,
        proposalTemplate,
        collaborationDocVersionId: parseProposalData(proposal.proposalData)
          .collaborationDocVersionId,
      })),
      // A single unavailable document must not break the whole read.
      { onFetchError: 'omit' },
    ),
  ]);

  let submittedCount = 0;
  let draftCount = 0;
  let lastSubmittedAt: string | null = null;

  const cards = assignments.map((assignment) => {
    // assignmentId is UNIQUE on reviews, so there is 0 or 1 row.
    const review = assignment.reviews[0] ?? null;

    if (review?.state === 'submitted') {
      submittedCount += 1;
      if (
        review.submittedAt &&
        (!lastSubmittedAt || review.submittedAt > lastSubmittedAt)
      ) {
        lastSubmittedAt = review.submittedAt;
      }
    }
    if (review?.state === 'draft') {
      draftCount += 1;
    }

    const parsed = parseProposalData(assignment.proposal.proposalData);
    const { previewText, systemFieldOverrides } = buildProposalListPreview({
      documentContent: documentContentMap.get(assignment.proposal.id),
      proposalTemplate,
      existingBudget: parsed.budget,
    });

    return {
      id: assignment.id,
      proposalId: assignment.proposal.id,
      proposalTitle: resolveProposalTitle(
        assignment.proposal.profile.name,
        assignment.proposal.proposalData,
      ),
      status: assignment.status,
      reviewState: review?.state ?? null,
      submittedAt: review?.submittedAt ?? null,
      categories: categoriesByProposalId.get(assignment.proposal.id) ?? [],
      // Declared non-optional, but the column is nullable — an unattributed
      // proposal is null at runtime.
      author: assignment.proposal.submittedBy
        ? {
            id: assignment.proposal.submittedBy.id,
            name: assignment.proposal.submittedBy.name,
            slug: assignment.proposal.submittedBy.slug,
          }
        : null,
      previewText,
      budget: systemFieldOverrides.budget ?? parsed.budget ?? null,
      reviewedCount: reviewedCountByProposalId.get(assignment.proposal.id) ?? 0,
    };
  });

  // Any profile id can be put in the URL, so identity is only returned for a
  // profile this process actually touches — otherwise this reads back the
  // name and email of an arbitrary platform user.
  const isEligible = eligibleProfileIds.includes(reviewerProfileId);
  const isAssociated = isEligible || assignments.length > 0;

  return reviewerAssignmentsSchema.parse({
    reviewer: isAssociated ? (reviewer ?? null) : null,
    isEligible,
    assignedCount: assignments.length,
    submittedCount,
    draftCount,
    lastSubmittedAt,
    assignments: cards,
  });
}

/**
 * Submitted reviews per proposal across EVERY reviewer — the "N Reviewed"
 * tally, which is a property of the proposal, not of this reviewer.
 */
async function getReviewedCountByProposalId({
  processInstanceId,
  phaseId,
  proposalIds,
}: {
  processInstanceId: string;
  phaseId: string;
  proposalIds: string[];
}): Promise<Map<string, number>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      proposalId: proposalReviewAssignments.proposalId,
      reviewedCount: count(proposalReviews.id),
    })
    .from(proposalReviewAssignments)
    .innerJoin(
      proposalReviews,
      eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
    )
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        eq(proposalReviewAssignments.phaseId, phaseId),
        inArray(proposalReviewAssignments.proposalId, proposalIds),
        eq(proposalReviews.state, ProposalReviewState.SUBMITTED),
      ),
    )
    .groupBy(proposalReviewAssignments.proposalId);

  return new Map(rows.map((row) => [row.proposalId, row.reviewedCount]));
}
