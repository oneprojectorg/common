import { type SQL, and, db, sql } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  proposals,
} from '@op/db/schema';
import { permission } from 'access-zones';

import {
  NotFoundError,
  PAGE_LIMIT,
  UnauthorizedError,
  ValidationError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import type { AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import { getProposalDevelopAccess } from './assertProposalDevelopAccess';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import {
  buildEntryCategoryCondition,
  buildEntrySearchCondition,
  getDevelopedEntryScope,
} from './ownDevelopedEntryScope';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import { resolveProposalTemplatesByFormSchemaId } from './resolveProposalTemplate';
import { getInstancePhases } from './schemas/instanceData';
import type {
  ListOwnDevelopedProposalsInput,
  OwnDevelopedProposalList,
} from './schemas/ownDevelopedProposals';

type EntryCursor = { value: string; id: string };

type EntryTotals = Pick<
  OwnDevelopedProposalList,
  'total' | 'readyTotal' | 'budgetTotal'
>;

/**
 * The developed proposals in the instance's current phase, each the target of
 * a live `developed` edge, with the proposals it was developed from. Under
 * `own` (the default), the caller's drafts and submitted ones; "own" is a
 * membership on the proposal's profile (author or co-author), the set that may
 * read a draft. Under `all`, every ready entry, for an admin only.
 * `categoryId` narrows either scope.
 *
 * Newest first, one cursor page at a time. The counts and the budget total
 * are aggregated in SQL over every entry the search and category match.
 */
export async function listOwnDevelopedProposals({
  processInstanceId,
  scope = 'own',
  categoryId,
  search,
  cursor,
  limit = PAGE_LIMIT.md,
  user,
}: ListOwnDevelopedProposalsInput & {
  user: AccessUser;
}): Promise<OwnDevelopedProposalList> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      processId: true,
      instanceData: true,
      currentStateId: true,
    },
  });

  if (!instance?.profileId) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.READ },
  });

  // Decoded before any early return, so a malformed cursor always throws.
  const decodedCursor = cursor ? decodeCursor<EntryCursor>(cursor) : undefined;

  if (scope === 'all') {
    await assertAdminOnCurrentPhase({ instance, user });
  }

  const entryScope = await getDevelopedEntryScope({
    instance,
    processInstanceId,
    authUserId: user.id,
    scope,
  });

  if (entryScope.isEmpty) {
    return {
      items: [],
      next: null,
      total: 0,
      readyTotal: 0,
      budgetTotal: null,
    };
  }

  const buildWhere = (table: typeof proposals): SQL =>
    and(
      entryScope.buildFilter(table),
      buildEntrySearchCondition(table, search),
      buildEntryCategoryCondition(table, categoryId),
    )!;

  const [rawRows, totals] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        RAW: (table) =>
          and(
            buildWhere(table),
            getCursorCondition({
              column: table.createdAt,
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: 'desc',
            }),
          )!,
      },
      columns: {
        id: true,
        profileId: true,
        status: true,
        visibility: true,
        createdAt: true,
        proposalData: true,
        formSchemaId: true,
      },
      with: { profile: { columns: { name: true } } },
      orderBy: { createdAt: 'desc', id: 'desc' },
      // One extra row tells whether a next page exists.
      limit: limit + 1,
    }),
    getEntryTotals(buildWhere),
  ]);

  const hasMore = rawRows.length > limit;
  const rows = hasMore ? rawRows.slice(0, limit) : rawRows;
  const lastRow = rows.at(-1);
  const next =
    hasMore && lastRow?.createdAt
      ? encodeCursor<EntryCursor>({ value: lastRow.createdAt, id: lastRow.id })
      : null;

  if (rows.length === 0) {
    return { items: [], next, ...totals };
  }

  const [edges, templateFor] = await Promise.all([
    db.query.proposalRelationships.findMany({
      where: {
        targetProposalId: { in: rows.map((row) => row.id) },
        relationshipType: ProposalRelationshipType.DEVELOPED,
        deletedAt: { isNull: true },
      },
      columns: { targetProposalId: true },
      with: {
        sourceProposal: {
          columns: { id: true },
          with: { profile: { columns: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc', id: 'asc' },
    }),
    resolveProposalTemplatesByFormSchemaId({
      formSchemaIds: rows.map((row) => row.formSchemaId),
      instanceData: instance.instanceData,
      processId: instance.processId,
    }),
  ]);

  // Title and budget live in the document while an entry is edited, so they
  // are resolved from it as the proposal list does.
  const documentContent = await getProposalDocumentsContent(
    rows.map((row) => ({
      id: row.id,
      proposalData: row.proposalData,
      proposalTemplate: templateFor(row.formSchemaId),
      collaborationDocVersionId:
        row.status === ProposalStatus.DRAFT
          ? undefined
          : parseProposalData(row.proposalData).collaborationDocVersionId,
    })),
    { onFetchError: 'omit' },
  );

  return {
    items: rows.map((row) => {
      const proposalData = parseProposalData(row.proposalData);
      const { systemFieldOverrides } = buildProposalListPreview({
        documentContent: documentContent.get(row.id),
        proposalTemplate: templateFor(row.formSchemaId),
        existingBudget: proposalData.budget,
      });

      return {
        id: row.id,
        profileId: row.profileId,
        status: row.status,
        visibility: row.visibility,
        createdAt: row.createdAt,
        title: systemFieldOverrides.title ?? row.profile?.name ?? '',
        category: proposalData.category,
        budget: systemFieldOverrides.budget ?? proposalData.budget ?? null,
        origins: edges
          .filter((edge) => edge.targetProposalId === row.id)
          .map((edge) => ({
            id: edge.sourceProposal.id,
            name: edge.sourceProposal.profile?.name ?? '',
          })),
      };
    }),
    next,
    ...totals,
  };
}

/**
 * Every entry of the phase is an admin's view: admin on the instance profile,
 * with the current phase a develop phase.
 */
async function assertAdminOnCurrentPhase({
  instance,
  user,
}: {
  instance: {
    profileId: string | null;
    instanceData: unknown;
    currentStateId: string | null;
  };
  user: AccessUser;
}): Promise<void> {
  if (!instance.currentStateId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  const { isAdmin } = await getProposalDevelopAccess({
    instance: {
      profileId: instance.profileId,
      instanceData: { phases: getInstancePhases(instance.instanceData) },
    },
    phaseId: instance.currentStateId,
    user,
  });

  if (!isAdmin) {
    throw new UnauthorizedError('Not authorized');
  }
}

/**
 * Counts and the budget total over every matching entry, in one aggregate.
 * The budget is the stored `proposalData.budget`, which autosave keeps
 * current: a canonical `{ amount, currency }`, or a legacy bare number in USD.
 */
async function getEntryTotals(
  buildWhere: (table: typeof proposals) => SQL,
): Promise<EntryTotals> {
  const budget = sql`(${proposals.proposalData}->'budget')`;
  const amount = sql`(CASE
    WHEN jsonb_typeof(${budget}->'amount') = 'number' THEN (${budget}->>'amount')::numeric
    WHEN jsonb_typeof(${budget}) = 'number' THEN (${budget})::text::numeric
  END)`;
  const currency = sql`(CASE
    WHEN jsonb_typeof(${budget}) = 'object' THEN ${budget}->>'currency'
    ELSE 'USD'
  END)`;

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      readyTotal: sql<number>`(count(*) FILTER (WHERE ${proposals.status} <> ${ProposalStatus.DRAFT}))::int`,
      budgetAmount: sql<
        string | null
      >`sum(${amount}) FILTER (WHERE ${amount} > 0)`,
      budgetCurrency: sql<
        string | null
      >`min(${currency}) FILTER (WHERE ${amount} > 0)`,
      currencyCount: sql<number>`(count(DISTINCT ${currency}) FILTER (WHERE ${amount} > 0))::int`,
    })
    .from(proposals)
    .where(buildWhere(proposals));

  const budgetTotal =
    row?.budgetAmount != null && row.budgetCurrency && row.currencyCount === 1
      ? { amount: Number(row.budgetAmount), currency: row.budgetCurrency }
      : null;

  return {
    total: row?.total ?? 0,
    readyTotal: row?.readyTotal ?? 0,
    budgetTotal,
  };
}
