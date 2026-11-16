import { type SQL, and, db, eq, exists, ne, or, sql } from '@op/db/client';
import { ProposalStatus, proposalCategories, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { listProposals } from './listProposals';
import { buildProposalTitleSearchCondition } from './proposalTitleSearch';
import { resolveProposalListScope } from './resolveProposalListScope';

export type PhaseProposalQuery =
  | { isEmpty: true }
  | {
      isEmpty: false;
      phaseIds: string[];
      buildWhere: (
        proposalsTable: typeof proposals,
        conditions: Array<SQL | undefined>,
      ) => SQL;
    };

/** Checks only READ, so callers gate first. */
export async function resolvePhaseProposalQuery({
  processInstanceId,
  phaseIds,
  user,
}: {
  processInstanceId: string;
  phaseIds?: string[];
  user: User;
}): Promise<PhaseProposalQuery> {
  const requestedPhaseIds: Array<string | undefined> = phaseIds ?? [undefined];
  const listScopes = await Promise.all(
    requestedPhaseIds.map((phaseId) =>
      resolveProposalListScope({
        input: { processInstanceId, phaseId },
        user,
      }),
    ),
  );

  const phaseScopes = listScopes.filter((listScope) => !listScope.isEmpty);
  const [firstScope] = listScopes;
  if (phaseScopes.length === 0 || !firstScope) {
    return { isEmpty: true };
  }

  return {
    isEmpty: false,
    phaseIds:
      phaseIds ??
      (firstScope.instance.currentStateId
        ? [firstScope.instance.currentStateId]
        : []),
    buildWhere: (proposalsTable, conditions) =>
      and(
        or(
          ...phaseScopes.map((listScope) =>
            listScope.buildWhereClause(proposalsTable),
          ),
        ),
        ne(proposalsTable.status, ProposalStatus.DRAFT),
        ...conditions,
      ) ?? sql`false`,
  };
}

export function buildProposalFilterConditions({
  proposalsTable,
  search,
  categoryIds,
}: {
  proposalsTable: typeof proposals;
  search?: string;
  categoryIds: string[];
}): SQL[] {
  const searchCondition = buildProposalTitleSearchCondition(
    proposalsTable,
    search,
  );

  return [
    ...(searchCondition ? [searchCondition] : []),
    ...categoryIds.map((categoryId) =>
      hasCategory({ proposalsTable, categoryId }),
    ),
  ];
}

export async function hydrateProposalsInOrder({
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

function hasCategory({
  proposalsTable,
  categoryId,
}: {
  proposalsTable: typeof proposals;
  categoryId: string;
}): SQL {
  return exists(
    db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(
        and(
          eq(proposalCategories.proposalId, proposalsTable.id),
          eq(proposalCategories.taxonomyTermId, categoryId),
        ),
      ),
  );
}
