import {
  type SQL,
  and,
  count,
  db,
  desc,
  eq,
  exists,
  isNull,
  ne,
} from '@op/db/client';
import {
  ProposalStatus,
  proposalCategories,
  proposalReviewAssignments,
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
  getCursorCondition,
} from '../../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../../assert';
import { getInstance } from '../getInstance';
import { listProposals } from '../listProposals';
import { decisionPermission } from '../permissions';
import { resolveProposalListScope } from '../resolveProposalListScope';
import {
  type PhaseReviewsReadContext,
  assertCanReadPhaseReviews,
} from '../reviewHelpers';
import {
  type ListReviewProposalsInput,
  type ReviewProposalList,
  reviewProposalListSchema,
} from '../schemas/reviews';
import { assertInstancePhase } from '../utils/instance';
import { isPhaseAtOrBefore } from '../utils/phaseOrder';

type ReviewProposalScope = ListReviewProposalsInput['scope'];

interface ReviewerAssignmentScope {
  phaseId: string;
  reviewerProfileId: string;
}

/**
 * A phase's submitted proposals for review, newest first, filtered by title
 * search and by every given category term — all of them (`scope: 'all'`) or
 * only those the caller is assigned to review (`scope: 'assigned'`).
 *
 * `all` is gated like the review page's "All proposals" tab: admins, or
 * reviewers on a phase with open reviews. `assigned` admits admins and
 * reviewers on the current phase or an earlier one, open reviews or not.
 * Rows are the ones `proposal.list` would show the caller — the scope comes
 * from `resolveProposalListScope` — minus drafts, which have nothing to
 * review. The page is picked here and hydrated by `listProposals`, so items
 * keep the `proposal.list` shape.
 */
export async function listReviewProposals({
  user,
  processInstanceId,
  phaseId,
  scope = 'all',
  search,
  categoryIds = [],
  cursor,
  limit = PAGE_LIMIT.md,
}: ListReviewProposalsInput & { user: User }): Promise<ReviewProposalList> {
  const instance = await getInstance({ instanceId: processInstanceId, user });
  const assignment = await assertCanListReviewProposals({
    instance,
    phaseId: phaseId ?? instance.currentStateId ?? undefined,
    scope,
    user,
  });

  const decodedCursor = decodeReviewProposalCursor(cursor);

  const listScope = await resolveProposalListScope({
    input: { processInstanceId, phaseId, search },
    user,
  });

  if (listScope.isEmpty) {
    return { items: [], next: null, total: 0 };
  }

  const where = and(
    listScope.buildWhereClause(proposals),
    ne(proposals.status, ProposalStatus.DRAFT),
    ...categoryIds.map((categoryId) => hasCategory(categoryId)),
    assignment ? isAssignedTo({ processInstanceId, ...assignment }) : undefined,
  );

  const [rows, [totals]] = await Promise.all([
    db
      .select({ id: proposals.id, createdAt: proposals.createdAt })
      .from(proposals)
      .where(
        and(
          where,
          getCursorCondition({
            column: proposals.createdAt,
            tieBreakerColumn: proposals.id,
            cursor: decodedCursor,
            direction: 'desc',
          }),
        ),
      )
      .orderBy(desc(proposals.createdAt), desc(proposals.id))
      .limit(limit + 1),
    db.select({ total: count() }).from(proposals).where(where),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return reviewProposalListSchema.parse({
    items: await hydrateInOrder({
      processInstanceId,
      proposalIds: pageRows.map((row) => row.id),
      user,
    }),
    next:
      hasMore && lastRow?.createdAt
        ? encodeCursor<ReviewProposalCursor>({
            value: lastRow.createdAt,
            id: lastRow.id,
          })
        : null,
    total: totals?.total ?? 0,
  });
}

const reviewProposalCursorSchema = z.object({
  // Compared against `created_at`; an unparseable value would fail the cast
  // in Postgres as a 500 instead of a 400.
  value: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.uuid(),
});

type ReviewProposalCursor = z.infer<typeof reviewProposalCursorSchema>;

function decodeReviewProposalCursor(
  cursor: string | null | undefined,
): ReviewProposalCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  // `decodeCursor` throws a bare 500 on unreadable input; keep every bad
  // cursor a 400.
  const decoded = ((): unknown => {
    try {
      return decodeCursor<unknown>(cursor);
    } catch {
      return undefined;
    }
  })();

  const result = reviewProposalCursorSchema.safeParse(decoded);
  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
}

/**
 * Gates the list by scope. Returns, for `assigned`, the assignment every row
 * must match.
 */
async function assertCanListReviewProposals({
  instance,
  phaseId,
  scope,
  user,
}: {
  instance: PhaseReviewsReadContext;
  phaseId: string | undefined;
  scope: ReviewProposalScope;
  user: User;
}): Promise<ReviewerAssignmentScope | undefined> {
  if (scope === 'assigned') {
    return await assertCanListAssignedProposals({ instance, phaseId, user });
  }
  await assertCanReadPhaseReviews({ instance, phaseId, user });
  return undefined;
}

/**
 * Admits an admin or reviewer on the instance profile to their own assigned
 * proposals, whatever the phase's open-reviews setting. The phase must be
 * the current one or an earlier one. No org fallback, as in
 * `listReviewAssignments`: that pattern is being retired.
 */
async function assertCanListAssignedProposals({
  instance,
  phaseId,
  user,
}: {
  instance: PhaseReviewsReadContext;
  phaseId: string | undefined;
  user: User;
}): Promise<ReviewerAssignmentScope> {
  if (!instance.profileId || !phaseId || instance.currentStateId == null) {
    throw new UnauthorizedError(
      "You don't have access to list assigned proposals for this phase",
    );
  }

  const [dbUser] = await Promise.all([
    assertUserByAuthId(user.id),
    assertProfileAccess({
      user,
      profileId: instance.profileId,
      permissions: [
        { decisions: decisionPermission.REVIEW },
        { decisions: permission.ADMIN },
      ],
    }),
  ]);

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  assertInstancePhase({ instance, phaseId });
  if (
    !isPhaseAtOrBefore(instance.instanceData, phaseId, instance.currentStateId)
  ) {
    throw new UnauthorizedError(
      "You don't have access to list assigned proposals for this phase",
    );
  }

  return { phaseId, reviewerProfileId: dbUser.profileId };
}

/** The caller's review assignment on the proposal in the phase, any status. */
function isAssignedTo({
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: ReviewerAssignmentScope & { processInstanceId: string }): SQL {
  return exists(
    db
      .select({ id: proposalReviewAssignments.id })
      .from(proposalReviewAssignments)
      .where(
        and(
          eq(proposalReviewAssignments.proposalId, proposals.id),
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          eq(proposalReviewAssignments.phaseId, phaseId),
          eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
          isNull(proposalReviewAssignments.deletedAt),
        ),
      ),
  );
}

/** One EXISTS per term, so a proposal must carry all of them. */
function hasCategory(categoryId: string): SQL {
  return exists(
    db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(
        and(
          eq(proposalCategories.proposalId, proposals.id),
          eq(proposalCategories.taxonomyTermId, categoryId),
        ),
      ),
  );
}

/** Hydrates the page through `listProposals` and keeps the order picked here. */
async function hydrateInOrder({
  processInstanceId,
  proposalIds,
  user,
}: {
  processInstanceId: string;
  proposalIds: string[];
  user: User;
}) {
  if (proposalIds.length === 0) {
    return [];
  }

  const { items } = await listProposals({
    input: { processInstanceId, proposalIds, limit: proposalIds.length },
    user,
  });
  const byId = new Map(items.map((item) => [item.id, item]));

  return proposalIds.flatMap((id) => byId.get(id) ?? []);
}
