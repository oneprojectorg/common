import {
  type SQL,
  and,
  count,
  db,
  eq,
  exists,
  inArray,
  isNull,
} from '@op/db/client';
import { proposalReviewAssignments, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { z } from 'zod';

import {
  NotFoundError,
  PAGE_LIMIT,
  UnauthorizedError,
  ValidationError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { getDevelopedProposalsBySource } from './getDevelopedProposalsBySource';
import {
  buildProposalFilterConditions,
  hydrateProposalsInOrder,
  resolvePhaseProposalQuery,
} from './phaseProposalQuery';
import {
  type ProposalReadContext,
  getProposalReadContext,
} from './proposalVisibility';
import type {
  DevelopSourceList,
  ListDevelopSourcesInput,
} from './schemas/developSources';
import {
  type PhaseProposalList,
  phaseProposalListSchema,
} from './schemas/proposal';

/**
 * Non-draft proposals of the phases, newest first, each with the entries
 * developed from it that the caller may read. Gated only by READ: no Develop
 * Proposals, Review or phase check, as `createDevelopedProposal` asserts
 * Develop Proposals.
 */
export async function listDevelopSources({
  user,
  processInstanceId,
  phaseIds,
  scope = 'all',
  search,
  categoryIds = [],
  cursor,
  limit = PAGE_LIMIT.md,
}: ListDevelopSourcesInput & { user: User }): Promise<DevelopSourceList> {
  const assignedToProfileId =
    scope === 'assigned' ? await getCallerProfileId(user) : undefined;

  const page = await listSourcePage({
    processInstanceId,
    phaseIds,
    assignedToProfileId,
    search,
    categoryIds,
    cursor,
    limit,
    user,
  });

  if (page.items.length === 0) {
    return { ...page, items: [] };
  }

  const developedBySource = await getDevelopedProposalsBySource({
    processInstanceId,
    sourceProposalIds: page.items.map((item) => item.id),
    readContext: await getReadContext({ processInstanceId, user }),
  });

  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      developedProposals: developedBySource.get(item.id) ?? [],
    })),
  };
}

async function listSourcePage({
  processInstanceId,
  phaseIds,
  assignedToProfileId,
  search,
  categoryIds,
  cursor,
  limit,
  user,
}: {
  processInstanceId: string;
  phaseIds: string[];
  assignedToProfileId?: string;
  search?: string;
  categoryIds: string[];
  cursor?: string | null;
  limit: number;
  user: User;
}): Promise<PhaseProposalList> {
  const decodedCursor = decodeSourceCursor(cursor);

  const query = await resolvePhaseProposalQuery({
    processInstanceId,
    phaseIds,
    user,
  });
  if (query.isEmpty) {
    return { items: [], next: null, total: 0 };
  }

  const buildWhere = (
    proposalsTable: typeof proposals,
    cursorCondition?: SQL,
  ): SQL =>
    query.buildWhere(proposalsTable, [
      ...buildProposalFilterConditions({ proposalsTable, search, categoryIds }),
      assignedToProfileId === undefined
        ? undefined
        : isAssignedTo({
            proposalsTable,
            processInstanceId,
            phaseIds: query.phaseIds,
            reviewerProfileId: assignedToProfileId,
          }),
      cursorCondition,
    ]);

  const [rows, [totals]] = await Promise.all([
    db.query.proposals.findMany({
      columns: { id: true, createdAt: true },
      where: {
        RAW: (table) =>
          buildWhere(
            table,
            getCursorCondition({
              column: table.createdAt,
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: 'desc',
            }),
          ),
      },
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
      limit: limit + 1,
    }),
    // The relational API has no aggregate, so the total stays a select.
    db.select({ total: count() }).from(proposals).where(buildWhere(proposals)),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return phaseProposalListSchema.parse({
    items: await hydrateProposalsInOrder({
      processInstanceId,
      proposalIds: pageRows.map((row) => row.id),
      user,
    }),
    next:
      hasMore && lastRow?.createdAt
        ? encodeCursor<SourceCursor>({
            value: lastRow.createdAt,
            id: lastRow.id,
          })
        : null,
    total: totals?.total ?? 0,
  });
}

const sourceCursorSchema = z.object({
  // A non-date value would fail in Postgres as a 500.
  value: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.uuid(),
});

type SourceCursor = z.infer<typeof sourceCursorSchema>;

function decodeSourceCursor(
  cursor: string | null | undefined,
): SourceCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  const decoded = ((): unknown => {
    try {
      return decodeCursor<unknown>(cursor);
    } catch {
      return undefined;
    }
  })();

  const result = sourceCursorSchema.safeParse(decoded);
  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
}

function isAssignedTo({
  proposalsTable,
  processInstanceId,
  phaseIds,
  reviewerProfileId,
}: {
  proposalsTable: typeof proposals;
  processInstanceId: string;
  phaseIds: string[];
  reviewerProfileId: string;
}): SQL {
  return exists(
    db
      .select({ id: proposalReviewAssignments.id })
      .from(proposalReviewAssignments)
      .where(
        and(
          eq(proposalReviewAssignments.proposalId, proposalsTable.id),
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          inArray(proposalReviewAssignments.phaseId, phaseIds),
          eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
          isNull(proposalReviewAssignments.deletedAt),
        ),
      ),
  );
}

/**
 * Asserts decisions Read on the decision's profile; its roles decide the
 * instance-admin arm.
 */
async function getReadContext({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<ProposalReadContext> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });
  if (!instance?.profileId) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const decisionRoles = await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.READ },
  });

  return getProposalReadContext({ user, decisionRoles });
}

async function getCallerProfileId(user: User): Promise<string> {
  const { profileId } = await assertUserByAuthId(
    user.id,
    new UnauthorizedError('User must have an active profile'),
  );
  if (!profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }
  return profileId;
}
