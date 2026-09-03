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

import { UnauthorizedError, ValidationError } from '../../../utils/error';
import { assertProfileAccess } from '../../assert';
import { getEligibleReviewerProfileIds } from '../getEligibleReviewerProfileIds';
import { getInstance } from '../getInstance';
import type { InstancePhaseRef } from '../schemas/instance';
import {
  type PhaseReviewerSummaries,
  phaseReviewerSummariesSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';

const DEFAULT_PHASE_REVIEWER_SUMMARY_LIMIT = 50;

/**
 * Keyset position in the fixed sort order. Opaque to the client — it is only
 * ever handed back, never constructed — but still validated on the way in so a
 * mangled cursor is a 400 rather than a SQL type error.
 */
const phaseReviewerCursorSchema = z.object({
  assignedCount: z.number().int().nonnegative(),
  name: z.string(),
  id: z.uuid(),
});

type PhaseReviewerCursor = z.infer<typeof phaseReviewerCursorSchema>;

/** Per-reviewer progress for one phase, aggregated in SQL: this screen renders no rows. */
export async function listPhaseReviewerSummaries({
  user,
  processInstanceId,
  phaseId,
  cursor,
  limit = DEFAULT_PHASE_REVIEWER_SUMMARY_LIMIT,
}: InstancePhaseRef & {
  user: User;
  cursor?: string | null;
  limit?: number;
}): Promise<PhaseReviewerSummaries> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  // No org fallback: admin access comes from a grant on the instance's own
  // profile, which legacy instances may not have — fail closed there.
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

  // An assignment only counts while its proposal is still reachable. Deleted
  // and moderation-detached proposals are invisible even to admins (see
  // detachProposalForModeration), so an assignment made before the detach
  // would otherwise leak the proposal back through the counts.
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

  // Anchored on `profiles`, not on the assignments, so a reviewer holding the
  // role but carrying nothing still gets a row — and so does one who lost the
  // role while assignments are still on their queue.
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
    // Every phase filter lives in the join condition rather than the WHERE:
    // as a predicate it would turn the left join into an inner one and drop
    // the reviewers who have no assignments at all.
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

  // Heaviest queue first; the table is scanned for workload. Sorting on an
  // aggregate means the keyset predicate cannot sit beside the GROUP BY, hence
  // the subquery. Mixed directions rule out a row-value comparison, so the
  // three sort keys are expanded by hand.
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

  // The totals are phase-wide, so they cannot come off the page. A window
  // count would be one round trip fewer, but it rides on the rows — an empty
  // trailing page (rows removed under a live cursor) would report zero
  // reviewers. This aggregate re-reads the same rollup and always answers.
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
            // '' matches the COALESCE the ORDER BY and the keyset both apply,
            // so a nameless reviewer sorts and resumes at the same place.
            name: lastRow.name ?? '',
            id: lastRow.id,
          })
        : null,
    totalReviewers: totals?.totalReviewers ?? 0,
    totalAssignments: totals?.totalAssignments ?? 0,
  });
}

function encodePhaseReviewerCursor(cursor: PhaseReviewerCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function decodePhaseReviewerCursor(
  cursor?: string | null,
): PhaseReviewerCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  const parsed = ((): unknown => {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return undefined;
    }
  })();

  const result = phaseReviewerCursorSchema.safeParse(parsed);

  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }

  return result.data;
}
