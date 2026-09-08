import {
  and,
  asc,
  db,
  desc,
  eq,
  exists,
  inArray,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalReviewState,
  profiles,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { z } from 'zod';

import {
  PAGE_LIMIT,
  UnauthorizedError,
  ValidationError,
  decodeCursor,
  encodeCursor,
} from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getEligibleReviewerProfileIds } from '../getEligibleReviewerProfileIds';
import { getInstance } from '../getInstance';
import type { InstancePhaseRef } from '../schemas/instance';
import {
  type PhaseReviewerSummaries,
  phaseReviewerSummariesSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';

export async function listPhaseReviewerSummaries({
  user,
  processInstanceId,
  phaseId,
  cursor,
  limit = PAGE_LIMIT.lg,
}: InstancePhaseRef & {
  user: User;
  cursor?: string | null;
  limit?: number;
}): Promise<PhaseReviewerSummaries> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  const decodedCursor = decodePhaseReviewerCursor(cursor);

  const eligibleProfileIds = await getEligibleReviewerProfileIds({
    decisionProfileId: instance.profileId,
  });

  // One row per reviewer: the profile columns plus the counts over their
  // assignments in this phase.
  const rollup = db
    .select({
      id: profiles.id,
      name: profiles.name,
      slug: profiles.slug,
      avatarImageId: profiles.avatarImageId,
      email: profiles.email,
      assignedCount: sql<number>`count(${proposalReviewAssignments.id})::int`
        .mapWith(Number)
        .as('assigned_count'),
      submittedCount:
        sql<number>`(count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED}))::int`
          .mapWith(Number)
          .as('submitted_count'),
      draftCount:
        sql<number>`(count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.DRAFT}))::int`
          .mapWith(Number)
          .as('draft_count'),
      lastSubmittedAt: sql<
        string | null
      >`max(${proposalReviews.submittedAt}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED})`.as(
        'last_submitted_at',
      ),
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
          ? inArray(profiles.id, eligibleProfileIds)
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
    .as('rollup');

  // Sort: most assignments first, id as the tiebreaker. Mixed directions rule
  // out a row-value comparison, so the cursor condition is expanded by hand.
  const afterCursor = decodedCursor
    ? or(
        sql`${rollup.assignedCount} < ${decodedCursor.assignedCount}`,
        and(
          sql`${rollup.assignedCount} = ${decodedCursor.assignedCount}`,
          sql`${rollup.id} > ${decodedCursor.id}`,
        ),
      )
    : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(rollup)
      .where(afterCursor)
      .orderBy(desc(rollup.assignedCount), asc(rollup.id))
      .limit(limit + 1),
    // The header shows the phase-wide reviewer count, which the page alone
    // cannot provide.
    db
      .select({
        totalReviewers: sql<number>`count(*)::int`.mapWith(Number),
        totalAssignments:
          sql<number>`COALESCE(sum(${rollup.assignedCount}), 0)::int`.mapWith(
            Number,
          ),
      })
      .from(rollup),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return phaseReviewerSummariesSchema.parse({
    reviewers: pageRows.map((row) => ({
      reviewer: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        avatarImageId: row.avatarImageId,
        email: row.email,
      },
      assignedCount: row.assignedCount,
      submittedCount: row.submittedCount,
      draftCount: row.draftCount,
      lastSubmittedAt: row.lastSubmittedAt,
    })),
    next:
      hasMore && lastRow
        ? encodePhaseReviewerCursor({
            assignedCount: lastRow.assignedCount,
            id: lastRow.id,
          })
        : null,
    totalReviewers: totals?.totalReviewers ?? 0,
    totalAssignments: totals?.totalAssignments ?? 0,
  });
}

const phaseReviewerCursorSchema = z.object({
  assignedCount: z.number().int().nonnegative(),
  id: z.uuid(),
});

type PhaseReviewerCursor = z.infer<typeof phaseReviewerCursorSchema>;

function encodePhaseReviewerCursor(cursor: PhaseReviewerCursor): string {
  return encodeCursor<PhaseReviewerCursor>(cursor);
}

function decodePhaseReviewerCursor(
  cursor?: string | null,
): PhaseReviewerCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  // `decodeCursor` raises a bare CommonError (500) on unreadable base64/JSON,
  // and its generic is an unchecked cast. Funnelling both failure modes into
  // the schema check keeps every bad cursor a 400 with one message.
  const decoded = ((): unknown => {
    try {
      return decodeCursor<unknown>(cursor);
    } catch {
      return undefined;
    }
  })();

  const result = phaseReviewerCursorSchema.safeParse(decoded);

  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }

  return result.data;
}
