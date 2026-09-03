import { aliasedTable, db, eq, inArray } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

import { NotFoundError } from '../../../utils';
import { getEligibleReviewerProfileIds } from '../getEligibleReviewerProfileIds';
import { getProposalIdsForPhase } from '../getProposalsForPhase';
import { getCategoriesByProposalIds } from '../listProposalsWithReviewAggregates';
import { type BudgetData, parseProposalData } from '../proposalDataSchema';
import { resolveProposalTitle } from './resolveProposalTitle';
import {
  type AdminDecisionReviewAssignments,
  adminDecisionReviewAssignmentsSchema,
} from '../schemas/reviewAssignments';
import type { ProposalCategoryItem } from '../schemas/proposalCategory';

/** Accumulator shape; enum fields validated by the output schema parse. */
interface ReviewerRollup {
  profile: { id: string; name: string | null; slug: string | null };
  assignedCount: number;
  submittedCount: number;
  draftCount: number;
  lastSubmittedAt: string | null;
  assignments: Array<{
    id: string;
    proposalId: string;
    proposalTitle: string | null;
    status: string;
    reviewState: string | null;
    submittedAt: string | null;
    categories: ProposalCategoryItem[];
    author: { id: string; name: string | null; slug: string | null } | null;
    previewText: string | null;
    budget: BudgetData | null;
  }>;
}

/**
 * Per-reviewer rollups for one phase plus the manual-assignment dialog's
 * candidate lists. Carries no authorization of its own — callers gate it.
 *
 * Fetches no documents, so `previewText` is always null here.
 */
export async function getDecisionReviewAssignments({
  instanceId,
  phaseId,
}: {
  instanceId: string;
  /** Omit for every phase. */
  phaseId?: string;
}): Promise<AdminDecisionReviewAssignments> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: {
      id: true,
      profileId: true,
      processId: true,
      instanceData: true,
      currentStateId: true,
    },
  });

  if (!instance) {
    throw new NotFoundError('Decision instance not found');
  }

  // Not paginated: bounded by reviewers × proposals of a single process.
  const [assignments, eligibleProfileIds, phaseProposalIds] = await Promise.all(
    [
      db.query.proposalReviewAssignments.findMany({
        where: {
          processInstanceId: instanceId,
          ...(phaseId && { phaseId }),
          // Unreachable even to admins (see detachProposalForModeration);
          // assignments made before the detach would otherwise leak it.
          proposal: {
            deletedAt: { isNull: true },
            moderationDetachedAt: { isNull: true },
          },
        },
        with: {
          reviewer: { columns: { id: true, name: true, slug: true } },
          reviews: {
            columns: { state: true, submittedAt: true },
          },
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
      instance.profileId
        ? getEligibleReviewerProfileIds({
            decisionProfileId: instance.profileId,
          })
        : Promise.resolve<string[]>([]),
      // A plain status filter would miss snapshot-attached proposals.
      getProposalIdsForPhase({ instance, phaseId }),
    ],
  );

  const categorizedProposalIds = [
    ...new Set([
      ...phaseProposalIds,
      ...assignments.map((assignment) => assignment.proposalId),
    ]),
  ];

  const proposalProfiles = aliasedTable(profiles, 'proposal_profiles');
  const assignableProposalsPromise =
    phaseProposalIds.length > 0
      ? db
          .select({
            id: proposals.id,
            proposalData: proposals.proposalData,
            profileName: proposalProfiles.name,
            submittedByProfileId: proposals.submittedByProfileId,
            authorId: profiles.id,
            authorName: profiles.name,
            authorSlug: profiles.slug,
          })
          .from(proposals)
          .leftJoin(profiles, eq(proposals.submittedByProfileId, profiles.id))
          .leftJoin(
            proposalProfiles,
            eq(proposals.profileId, proposalProfiles.id),
          )
          .where(inArray(proposals.id, phaseProposalIds))
      : Promise.resolve([]);

  const eligibleReviewersPromise =
    eligibleProfileIds.length > 0
      ? db
          .select({
            id: profiles.id,
            name: profiles.name,
            slug: profiles.slug,
            email: profiles.email,
          })
          .from(profiles)
          .where(inArray(profiles.id, eligibleProfileIds))
      : Promise.resolve([]);

  const [assignableProposals, eligibleReviewers, categoriesByProposalId] =
    await Promise.all([
      assignableProposalsPromise,
      eligibleReviewersPromise,
      getCategoriesByProposalIds(categorizedProposalIds),
    ]);

  const byReviewer = new Map<string, ReviewerRollup>();
  const cardFieldsByProposalId = new Map<
    string,
    { previewText: string | null; budget: BudgetData | null }
  >();

  for (const assignment of assignments) {
    // assignmentId is UNIQUE on reviews, so there is 0 or 1 row.
    const review = assignment.reviews[0] ?? null;

    const reviewer = byReviewer.get(assignment.reviewerProfileId) ?? {
      profile: {
        id: assignment.reviewer.id,
        name: assignment.reviewer.name,
        slug: assignment.reviewer.slug,
      },
      assignedCount: 0,
      submittedCount: 0,
      draftCount: 0,
      lastSubmittedAt: null,
      assignments: [],
    };

    reviewer.assignedCount += 1;
    if (review?.state === 'submitted') {
      reviewer.submittedCount += 1;
      if (
        review.submittedAt &&
        (!reviewer.lastSubmittedAt ||
          review.submittedAt > reviewer.lastSubmittedAt)
      ) {
        reviewer.lastSubmittedAt = review.submittedAt;
      }
    }
    if (review?.state === 'draft') {
      reviewer.draftCount += 1;
    }

    let cardFields = cardFieldsByProposalId.get(assignment.proposal.id);
    if (!cardFields) {
      cardFields = {
        previewText: null,
        budget:
          parseProposalData(assignment.proposal.proposalData).budget ?? null,
      };
      cardFieldsByProposalId.set(assignment.proposal.id, cardFields);
    }

    reviewer.assignments.push({
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
      previewText: cardFields.previewText,
      budget: cardFields.budget,
    });

    byReviewer.set(assignment.reviewerProfileId, reviewer);
  }

  const reviewers = [...byReviewer.values()].sort(
    (a, b) =>
      b.submittedCount - a.submittedCount ||
      (a.profile.name ?? '').localeCompare(b.profile.name ?? ''),
  );

  return adminDecisionReviewAssignmentsSchema.parse({
    reviewers,
    totalAssignments: assignments.length,
    eligibleReviewers: eligibleReviewers.sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? ''),
    ),
    proposals: assignableProposals.map((proposal) => {
      return {
        id: proposal.id,
        title: resolveProposalTitle(
          proposal.profileName,
          proposal.proposalData,
        ),
        submittedByProfileId: proposal.submittedByProfileId,
        categories: categoriesByProposalId.get(proposal.id) ?? [],
        author: proposal.authorId
          ? {
              id: proposal.authorId,
              name: proposal.authorName,
              slug: proposal.authorSlug,
            }
          : null,
      };
    }),
  });
}
