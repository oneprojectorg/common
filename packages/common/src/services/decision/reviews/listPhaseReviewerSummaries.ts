import {
  and,
  asc,
  db,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalReviewState,
  profiles,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
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

const phaseReviewerCursorSchema = z.object({
  assignedCount: z.number().int().nonnegative(),
  name: z.string(),
  id: z.uuid(),
});

type PhaseReviewerCursor = z.infer<typeof phaseReviewerCursorSchema>;

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

  // Deleted and moderation-detached proposals are invisible even to admins, so
  // an assignment made before the detach must stop counting.
  const countsTowardsPhase = (
    assignmentProposalId: typeof proposalReviewAssignments.proposalId,
  ) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(proposals)
        .where(
          and(
            eq(proposals.id, assignmentProposalId),
            isNull(proposals.deletedAt),
            isNull(proposals.moderationDetachedAt),
          ),
        ),
    );

  const holdsAnAssignment = exists(
    db
      .select({ one: sql`1` })
      .from(proposalReviewAssignments)
      .where(
        and(
          eq(proposalReviewAssignments.reviewerProfileId, profiles.id),
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          eq(proposalReviewAssignments.phaseId, phaseId),
          countsTowardsPhase(proposalReviewAssignments.proposalId),
        ),
      ),
  );

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
        countsTowardsPhase(proposalReviewAssignments.proposalId),
      ),
    )
    .leftJoin(
      proposalReviews,
      eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
    )
    .where(
      eligibleProfileIds.length > 0
        ? or(inArray(profiles.id, eligibleProfileIds), holdsAnAssignment)
        : holdsAnAssignment,
    )
    .groupBy(
      profiles.id,
      profiles.name,
      profiles.slug,
      profiles.avatarImageId,
      profiles.email,
    )
    .as('rollup');

  // Mixed sort directions rule out a row-value comparison, so the three sort
  // keys are expanded by hand.
  const keysetCondition = decodedCursor
    ? sql`(
        ${rollup.assignedCount} < ${decodedCursor.assignedCount}
        OR (
          ${rollup.assignedCount} = ${decodedCursor.assignedCount}
          AND (
            COALESCE(${rollup.name}, '') > ${decodedCursor.name}
            OR (
              COALESCE(${rollup.name}, '') = ${decodedCursor.name}
              AND ${rollup.id} > ${decodedCursor.id}
            )
          )
        )
      )`
    : undefined;

  const rows = await db
    .select()
    .from(rollup)
    .where(keysetCondition)
    .orderBy(
      desc(rollup.assignedCount),
      asc(sql`COALESCE(${rollup.name}, '')`),
      asc(rollup.id),
    )
    .limit(limit + 1);

  // Phase-wide totals, so they cannot come off the page: a window count rides
  // on the rows and would report zero on an empty trailing page.
  const [totals] = await db
    .select({
      totalReviewers: sql<number>`count(*)::int`.mapWith(Number),
      totalAssignments:
        sql<number>`COALESCE(sum(${rollup.assignedCount}), 0)::int`.mapWith(
          Number,
        ),
    })
    .from(rollup);

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
            name: lastRow.name ?? '',
            id: lastRow.id,
          })
        : null,
    totalReviewers: totals?.totalReviewers ?? 0,
    totalAssignments: totals?.totalAssignments ?? 0,
  });
}

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
