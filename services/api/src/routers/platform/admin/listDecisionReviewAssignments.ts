import { NotFoundError, getEligibleReviewerProfileIds } from '@op/common';
import { adminDecisionReviewAssignmentsSchema } from '@op/common/client';
import { and, db, eq, inArray, ne } from '@op/db/client';
import { ProposalStatus, profiles, proposals } from '@op/db/schema';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

const proposalTitleData = z.object({ title: z.string().nullish() }).partial();

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
  }>;
}

export const listDecisionReviewAssignmentsRouter = router({
  listDecisionReviewAssignments: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        instanceId: z.uuid(),
        phaseId: z.string().optional(),
      }),
    )
    .output(adminDecisionReviewAssignmentsSchema)
    .query(async ({ input }) => {
      const instance = await db.query.processInstances.findFirst({
        where: { id: input.instanceId },
        columns: { id: true, profileId: true },
      });

      if (!instance) {
        throw new NotFoundError('Decision instance not found');
      }

      // Whole-phase fetch, grouped per reviewer below. Not paginated: the
      // result set is bounded by reviewers × proposals of a single process.
      const [assignments, eligibleProfileIds, assignableProposals] =
        await Promise.all([
          db.query.proposalReviewAssignments.findMany({
            where: {
              processInstanceId: input.instanceId,
              ...(input.phaseId && { phaseId: input.phaseId }),
            },
            with: {
              reviewer: { columns: { id: true, name: true, slug: true } },
              reviews: {
                columns: { state: true, submittedAt: true },
              },
              proposal: { columns: { id: true, proposalData: true } },
            },
            orderBy: { assignedAt: 'asc' },
          }),
          instance.profileId
            ? getEligibleReviewerProfileIds(instance.profileId)
            : Promise.resolve<string[]>([]),
          db
            .select({
              id: proposals.id,
              proposalData: proposals.proposalData,
              submittedByProfileId: proposals.submittedByProfileId,
            })
            .from(proposals)
            .where(
              and(
                eq(proposals.processInstanceId, input.instanceId),
                ne(proposals.status, ProposalStatus.DRAFT),
              ),
            ),
        ]);

      const eligibleReviewers =
        eligibleProfileIds.length > 0
          ? await db
              .select({
                id: profiles.id,
                name: profiles.name,
                slug: profiles.slug,
              })
              .from(profiles)
              .where(inArray(profiles.id, eligibleProfileIds))
          : [];

      const byReviewer = new Map<string, ReviewerRollup>();

      for (const assignment of assignments) {
        // assignmentId is UNIQUE on reviews, so there is 0 or 1 row.
        const review = assignment.reviews[0] ?? null;
        const titleParsed = proposalTitleData.safeParse(
          assignment.proposal.proposalData,
        );

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

        reviewer.assignments.push({
          id: assignment.id,
          proposalId: assignment.proposal.id,
          proposalTitle: titleParsed.success
            ? (titleParsed.data.title ?? null)
            : null,
          status: assignment.status,
          reviewState: review?.state ?? null,
          submittedAt: review?.submittedAt ?? null,
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
          a.name.localeCompare(b.name),
        ),
        proposals: assignableProposals.map((proposal) => {
          const titleParsed = proposalTitleData.safeParse(
            proposal.proposalData,
          );
          return {
            id: proposal.id,
            title: titleParsed.success
              ? (titleParsed.data.title ?? null)
              : null,
            submittedByProfileId: proposal.submittedByProfileId,
          };
        }),
      });
    }),
});
