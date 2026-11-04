import {
  type SQL,
  type SQLWrapper,
  and,
  asc,
  db,
  eq,
  exists,
  ilike,
  inArray,
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
import {
  type PhaseReviewerSummaries,
  type PhaseReviewerSummariesParams,
  type ReviewerSort,
  type ReviewerStatus,
  phaseReviewerSummariesSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';
import { escapeLikePattern, splitSearchWords } from '../utils/search';

export async function listPhaseReviewerSummaries({
  user,
  processInstanceId,
  phaseId,
  cursor,
  limit = PAGE_LIMIT.lg,
  search,
  status,
  sort = 'leastComplete',
}: PhaseReviewerSummariesParams & {
  user: User;
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

  const decodedCursor = decodePhaseReviewerCursor(cursor, sort);

  const eligibleProfileIds = await getEligibleReviewerProfileIds({
    decisionProfileId: instance.profileId,
  });

  const assignedCount = sql`count(${proposalReviewAssignments.id})`;
  const submittedCount = sql`count(*) filter (where ${proposalReviewAssignments.status} = ${ProposalReviewAssignmentStatus.COMPLETED})`;
  const draftCount = sql`count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.DRAFT})`;

  // One row per reviewer: the profile columns plus the counts over their
  // assignments in this phase.
  const rollup = db
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

  const { orderBy, afterCursor } = getReviewerOrder({
    rollup,
    sort,
    cursor: decodedCursor,
  });

  const filters: SQL | undefined = and(
    status ? eq(rollup.status, status) : undefined,
    ...splitSearchWords(search).map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return or(ilike(rollup.name, pattern), ilike(rollup.email, pattern));
    }),
  );

  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(rollup)
      .where(and(filters, afterCursor))
      .orderBy(...orderBy)
      .limit(limit + 1),
    db
      .select({
        total: (filters
          ? sql<number>`(count(*) filter (where ${filters}))::int`
          : sql<number>`count(*)::int`
        ).mapWith(Number),
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
    items: pageRows.map((row) => ({
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
      status: row.status,
    })),
    next:
      hasMore && lastRow
        ? encodePhaseReviewerCursor(
            toPhaseReviewerCursor({ sort, row: lastRow }),
          )
        : null,
    total: totals?.total ?? 0,
    totalReviewers: totals?.totalReviewers ?? 0,
    totalAssignments: totals?.totalAssignments ?? 0,
  });
}

const countSchema = z.number().int().nonnegative();

const phaseReviewerCursorSchema = z.discriminatedUnion('sort', [
  z.object({
    sort: z.enum(['leastComplete', 'mostComplete']),
    submittedCount: countSchema,
    assignedCount: countSchema,
    id: z.uuid(),
  }),
  z.object({
    sort: z.literal('recentActivity'),
    lastSubmittedAt: z.string().nullable(),
    id: z.uuid(),
  }),
  z.object({
    sort: z.literal('name'),
    name: z.string(),
    id: z.uuid(),
  }),
]);

type PhaseReviewerCursor = z.infer<typeof phaseReviewerCursorSchema>;

function completionRatio({
  submitted,
  assigned,
}: {
  submitted: SQLWrapper;
  assigned: SQLWrapper;
}): SQL<string | null> {
  return sql`(${submitted})::numeric / nullif(${assigned}, 0)`;
}

type ReviewerRollup = Record<
  'id' | 'name' | 'lastSubmittedAt' | 'completionRatio',
  SQLWrapper
>;

function getReviewerOrder({
  rollup,
  sort,
  cursor,
}: {
  rollup: ReviewerRollup;
  sort: ReviewerSort;
  cursor: PhaseReviewerCursor | undefined;
}): { orderBy: SQL[]; afterCursor: SQL | undefined } {
  switch (sort) {
    case 'leastComplete':
    case 'mostComplete': {
      const direction = sort === 'leastComplete' ? sql`asc` : sql`desc`;
      return {
        orderBy: [
          sql`${rollup.completionRatio} ${direction} nulls last`,
          asc(rollup.id),
        ],
        afterCursor:
          cursor && 'assignedCount' in cursor
            ? afterNullsLast({
                column: rollup.completionRatio,
                value:
                  cursor.assignedCount > 0
                    ? completionRatio({
                        submitted: sql`${cursor.submittedCount}::int`,
                        assigned: sql`${cursor.assignedCount}::int`,
                      })
                    : null,
                direction: sort === 'leastComplete' ? 'asc' : 'desc',
                id: rollup.id,
                cursorId: cursor.id,
              })
            : undefined,
      };
    }
    case 'recentActivity':
      return {
        orderBy: [
          sql`${rollup.lastSubmittedAt} desc nulls last`,
          asc(rollup.id),
        ],
        afterCursor:
          cursor && 'lastSubmittedAt' in cursor
            ? afterNullsLast({
                column: rollup.lastSubmittedAt,
                value:
                  cursor.lastSubmittedAt != null
                    ? sql`${cursor.lastSubmittedAt}::timestamptz`
                    : null,
                direction: 'desc',
                id: rollup.id,
                cursorId: cursor.id,
              })
            : undefined,
      };
    case 'name':
      return {
        orderBy: [asc(rollup.name), asc(rollup.id)],
        afterCursor:
          cursor && 'name' in cursor
            ? sql`(${rollup.name}, ${rollup.id}) > (${cursor.name}, ${cursor.id})`
            : undefined,
      };
  }
}

/** A null cursor value means the previous page ended inside the null rows. */
function afterNullsLast({
  column,
  value,
  direction,
  id,
  cursorId,
}: {
  column: SQLWrapper;
  value: SQL | null;
  direction: 'asc' | 'desc';
  id: SQLWrapper;
  cursorId: string;
}): SQL | undefined {
  if (value == null) {
    return and(sql`${column} is null`, sql`${id} > ${cursorId}`);
  }

  return or(
    direction === 'asc' ? sql`${column} > ${value}` : sql`${column} < ${value}`,
    and(sql`${column} = ${value}`, sql`${id} > ${cursorId}`),
    sql`${column} is null`,
  );
}

function toPhaseReviewerCursor({
  sort,
  row,
}: {
  sort: ReviewerSort;
  row: {
    id: string;
    name: string;
    lastSubmittedAt: string | null;
    submittedCount: number;
    assignedCount: number;
  };
}): PhaseReviewerCursor {
  switch (sort) {
    case 'leastComplete':
    case 'mostComplete':
      return {
        sort,
        submittedCount: row.submittedCount,
        assignedCount: row.assignedCount,
        id: row.id,
      };
    case 'recentActivity':
      return { sort, lastSubmittedAt: row.lastSubmittedAt, id: row.id };
    case 'name':
      return { sort, name: row.name, id: row.id };
  }
}

function encodePhaseReviewerCursor(cursor: PhaseReviewerCursor): string {
  return encodeCursor<PhaseReviewerCursor>(cursor);
}

function decodePhaseReviewerCursor(
  cursor: string | null | undefined,
  sort: ReviewerSort,
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

  if (!result.success || result.data.sort !== sort) {
    throw new ValidationError('Invalid cursor');
  }

  return result.data;
}
