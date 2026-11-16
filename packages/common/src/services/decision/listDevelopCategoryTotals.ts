import { type SQL, and, db, eq, inArray, sql } from '@op/db/client';
import { proposalCategories, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getProposalDevelopAccess } from './assertProposalDevelopAccess';
import { getDevelopOriginPhaseId } from './developOriginScope';
import { getProcessCategories } from './getProcessCategories';
import { getDevelopedEntryScope } from './ownDevelopedEntryScope';
import { resolveProposalListScope } from './resolveProposalListScope';
import type {
  DevelopCategoryTotals,
  ListDevelopCategoryTotalsInput,
} from './schemas/developCategoryTotals';
import { getInstancePhases } from './schemas/instanceData';

type CategoryCount = { categoryId: string; count: number };

/**
 * Every category of the instance with two counts for the current develop
 * phase: the origins (proposals of the phase before it, as
 * `listDevelopOrigins` lists them under `all`) and the ready entries (as
 * `listOwnDevelopedProposals` lists them under `all`). Admin only. Each count
 * is one grouped query; the categories keep the instance's order.
 */
export async function listDevelopCategoryTotals({
  input,
  user,
}: {
  input: ListDevelopCategoryTotalsInput;
  user: User;
}): Promise<DevelopCategoryTotals[]> {
  const { processInstanceId } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      instanceData: true,
      currentStateId: true,
    },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.currentStateId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  const phases = getInstancePhases(instance.instanceData);
  const developPhaseId = instance.currentStateId;

  const { isAdmin } = await getProposalDevelopAccess({
    instance: { profileId: instance.profileId, instanceData: { phases } },
    phaseId: developPhaseId,
    user,
  });

  if (!isAdmin) {
    throw new UnauthorizedError('Not authorized');
  }

  const categories = await getProcessCategories({ processInstanceId, user });
  if (categories.length === 0) {
    return [];
  }

  const categoryIds = categories.map((category) => category.id);
  const originPhaseId = getDevelopOriginPhaseId({ phases, developPhaseId });

  const [originCounts, entryCounts] = await Promise.all([
    originPhaseId
      ? countOrigins({ processInstanceId, originPhaseId, categoryIds, user })
      : [],
    countReadyEntries({ instance, processInstanceId, categoryIds, user }),
  ]);

  const originsByCategory = toCountMap(originCounts);
  const entriesByCategory = toCountMap(entryCounts);

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    originsTotal: originsByCategory.get(category.id) ?? 0,
    readyEntriesTotal: entriesByCategory.get(category.id) ?? 0,
  }));
}

async function countOrigins({
  processInstanceId,
  originPhaseId,
  categoryIds,
  user,
}: {
  processInstanceId: string;
  originPhaseId: string;
  categoryIds: string[];
  user: User;
}): Promise<CategoryCount[]> {
  const scope = await resolveProposalListScope({
    input: { processInstanceId, phaseId: originPhaseId },
    user,
  });

  if (scope.isEmpty) {
    return [];
  }

  return countByCategory({
    categoryIds,
    where: scope.buildWhereClause(proposals),
  });
}

async function countReadyEntries({
  instance,
  processInstanceId,
  categoryIds,
  user,
}: {
  instance: {
    id: string;
    instanceData: unknown;
    currentStateId: string | null;
  };
  processInstanceId: string;
  categoryIds: string[];
  user: User;
}): Promise<CategoryCount[]> {
  const scope = await getDevelopedEntryScope({
    instance,
    processInstanceId,
    authUserId: user.id,
    scope: 'all',
  });

  if (scope.isEmpty) {
    return [];
  }

  return countByCategory({ categoryIds, where: scope.buildFilter(proposals) });
}

function countByCategory({
  categoryIds,
  where,
}: {
  categoryIds: string[];
  where: SQL;
}): Promise<CategoryCount[]> {
  return db
    .select({
      categoryId: proposalCategories.taxonomyTermId,
      count: sql<number>`count(DISTINCT ${proposals.id})::int`,
    })
    .from(proposals)
    .innerJoin(
      proposalCategories,
      eq(proposalCategories.proposalId, proposals.id),
    )
    .where(and(where, inArray(proposalCategories.taxonomyTermId, categoryIds)))
    .groupBy(proposalCategories.taxonomyTermId);
}

function toCountMap(counts: CategoryCount[]): Map<string, number> {
  return new Map(counts.map(({ categoryId, count }) => [categoryId, count]));
}
