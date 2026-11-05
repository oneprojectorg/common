import {
  type SQL,
  type SQLWrapper,
  and,
  db,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  profiles,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';

import type { ReviewerStatus } from '../schemas/reviewAssignments';
import { escapeLikePattern, splitSearchWords } from '../utils/search';

export type PhaseReviewerRollup = ReturnType<typeof buildPhaseReviewerRollup>;

export function buildPhaseReviewerRollup({
  processInstanceId,
  phaseId,
  eligibleProfileIds = [],
}: {
  processInstanceId: string;
  phaseId: string;
  /** Reviewers to list even without an assignment in the phase. */
  eligibleProfileIds?: ReadonlyArray<string>;
}) {
  const assignedCount = sql`count(${proposalReviewAssignments.id})`;
  const submittedCount = sql`count(*) filter (where ${proposalReviewAssignments.status} = ${ProposalReviewAssignmentStatus.COMPLETED})`;
  const draftCount = sql`count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.DRAFT})`;
  const remainingCount = sql`count(*) filter (where ${and(
    inArray(proposalReviewAssignments.status, [
      ProposalReviewAssignmentStatus.PENDING,
      ProposalReviewAssignmentStatus.IN_PROGRESS,
      ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    ]),
    isNull(proposalReviewAssignments.deletedAt),
  )})`;

  return (
    db
      .select({
        id: profiles.id,
        name: profiles.name,
        slug: profiles.slug,
        avatarImageId: profiles.avatarImageId,
        email: profiles.email,
        assignedCount: sql<number>`(${assignedCount})::int`
          .mapWith(Number)
          .as('assigned_count'),
        submittedCount: sql<number>`(${submittedCount})::int`
          .mapWith(Number)
          .as('submitted_count'),
        draftCount: sql<number>`(${draftCount})::int`
          .mapWith(Number)
          .as('draft_count'),
        remainingCount: sql<number>`(${remainingCount})::int`
          .mapWith(Number)
          .as('remaining_count'),
        status: sql<ReviewerStatus>`case
        when ${assignedCount} = 0 then 'none'
        when ${submittedCount} = 0 and ${draftCount} = 0 then ${ProposalReviewAssignmentStatus.PENDING}
        when ${submittedCount} < ${assignedCount} then ${ProposalReviewAssignmentStatus.IN_PROGRESS}
        else ${ProposalReviewAssignmentStatus.COMPLETED}
      end`.as('status'),
        lastSubmittedAt: sql<
          string | null
        >`max(${proposalReviews.submittedAt}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED})`.as(
          'last_submitted_at',
        ),
        completionRatio: completionRatio({
          submitted: submittedCount,
          assigned: assignedCount,
        }).as('completion_ratio'),
      })
      .from(profiles)
      // The phase filters stay in the join condition: as WHERE predicates they
      // would turn this left join into an inner one and drop idle reviewers.
      .leftJoin(
        proposalReviewAssignments,
        and(
          eq(proposalReviewAssignments.reviewerProfileId, profiles.id),
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          eq(proposalReviewAssignments.phaseId, phaseId),
        ),
      )
      .leftJoin(
        proposalReviews,
        eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
      )
      // Eligible reviewers, plus anyone who holds an assignment in this phase
      // but is no longer eligible (e.g. a removed member).
      .where(
        or(
          eligibleProfileIds.length > 0
            ? inArray(profiles.id, [...eligibleProfileIds])
            : undefined,
          exists(
            db
              .select({ one: sql`1` })
              .from(proposalReviewAssignments)
              .where(
                and(
                  eq(proposalReviewAssignments.reviewerProfileId, profiles.id),
                  eq(
                    proposalReviewAssignments.processInstanceId,
                    processInstanceId,
                  ),
                  eq(proposalReviewAssignments.phaseId, phaseId),
                ),
              ),
          ),
        ),
      )
      // `profiles.id` is the primary key, so Postgres lets the other profile
      // columns through without listing them here.
      .groupBy(profiles.id)
      .as('rollup')
  );
}

export function getPhaseReviewerFilters({
  rollup,
  search,
  status,
}: {
  rollup: PhaseReviewerRollup;
  search: string | undefined;
  status: ReviewerStatus | undefined;
}): SQL | undefined {
  return and(
    status ? eq(rollup.status, status) : undefined,
    ...splitSearchWords(search).map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return or(ilike(rollup.name, pattern), ilike(rollup.email, pattern));
    }),
  );
}

export function completionRatio({
  submitted,
  assigned,
}: {
  submitted: SQLWrapper;
  assigned: SQLWrapper;
}): SQL<string | null> {
  return sql`(${submitted})::numeric / nullif(${assigned}, 0)`;
}
