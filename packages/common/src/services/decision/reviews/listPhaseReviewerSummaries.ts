import {
  type SQL,
  type SQLWrapper,
  and,
  asc,
  db,
  desc,
  or,
  sql,
} from '@op/db/client';
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
  DEFAULT_REVIEWER_SORT,
  type PhaseReviewerSummaries,
  type PhaseReviewerSummariesParams,
  type ReviewerSort,
  phaseReviewerSummariesSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';
import {
  buildPhaseReviewerRollup,
  completionRatio,
  getPhaseReviewerFilters,
  toEligibleReviewer,
} from './phaseReviewerRollup';

export async function listPhaseReviewerSummaries({
  user,
  processInstanceId,
  phaseId,
  cursor,
  limit = PAGE_LIMIT.lg,
  search,
  status,
  sort = DEFAULT_REVIEWER_SORT,
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

  const rollup = buildPhaseReviewerRollup({
    processInstanceId,
    phaseId,
    eligibleProfileIds,
  });

  const { orderBy, afterCursor } = getReviewerOrder({
    rollup,
    sort,
    cursor: decodedCursor,
  });

  const filters = getPhaseReviewerFilters({ rollup, search, status });

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
      reviewer: toEligibleReviewer(row),
      assignedCount: row.assignedCount,
      submittedCount: row.submittedCount,
      draftCount: row.draftCount,
      remainingCount: row.remainingCount,
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

type ReviewerRollup = Record<
  'id' | 'name' | 'lastSubmittedAt' | 'completionRatio' | 'assignedCount',
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
      // On an equal ratio the reviewer with more assignments comes first.
      return {
        orderBy: [
          sql`${rollup.completionRatio} ${direction} nulls last`,
          desc(rollup.assignedCount),
          asc(rollup.id),
        ],
        afterCursor:
          cursor && 'assignedCount' in cursor
            ? afterCompletionCursor({
                rollup,
                direction: sort === 'leastComplete' ? 'asc' : 'desc',
                cursor,
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

/** Ratio in the sort direction, then assigned count descending, then id. */
function afterCompletionCursor({
  rollup,
  direction,
  cursor,
}: {
  rollup: ReviewerRollup;
  direction: 'asc' | 'desc';
  cursor: { submittedCount: number; assignedCount: number; id: string };
}): SQL | undefined {
  const ratio = rollup.completionRatio;

  // Every row with a null ratio has nothing assigned, so only the id is left.
  if (cursor.assignedCount === 0) {
    return and(sql`${ratio} is null`, sql`${rollup.id} > ${cursor.id}`);
  }

  const cursorRatio = completionRatio({
    submitted: sql`${cursor.submittedCount}::int`,
    assigned: sql`${cursor.assignedCount}::int`,
  });

  return or(
    direction === 'asc'
      ? sql`${ratio} > ${cursorRatio}`
      : sql`${ratio} < ${cursorRatio}`,
    and(
      sql`${ratio} = ${cursorRatio}`,
      or(
        sql`${rollup.assignedCount} < ${cursor.assignedCount}`,
        and(
          sql`${rollup.assignedCount} = ${cursor.assignedCount}`,
          sql`${rollup.id} > ${cursor.id}`,
        ),
      ),
    ),
    sql`${ratio} is null`,
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
