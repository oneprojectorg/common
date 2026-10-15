import type { RouterOutput } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { PAGE_LIMIT } from '@op/common/client';
import {
  type inferParserType,
  createLoader,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

const SORTS = ['newest', 'oldest', 'name'] as const;
export type Sort = (typeof SORTS)[number];

type FilterTerms = RouterOutput['organization']['listFilterTerms'];
type DirectoryFilters = inferParserType<typeof directorySearchParams>;

const SORT_INPUT = {
  newest: { orderBy: 'createdAt', dir: 'desc' },
  oldest: { orderBy: 'createdAt', dir: 'asc' },
  name: { orderBy: 'name', dir: 'asc' },
} as const;

export const directorySearchParams = {
  focusArea: parseAsString,
  strategy: parseAsString,
  sort: parseAsStringLiteral(SORTS).withDefault('newest'),
};

export const loadDirectorySearchParams = createLoader(directorySearchParams);

/** A slug that matches no term in use is dropped, as if unset. */
export const getOrganizationListInput = (
  { focusArea, strategy, sort }: DirectoryFilters,
  terms: FilterTerms | undefined,
) => {
  const focusAreaId = terms?.focusAreas.find(
    ({ slug }) => slug === focusArea,
  )?.id;
  const strategyId = terms?.strategies.find(
    ({ slug }) => slug === strategy,
  )?.id;

  return {
    limit: PAGE_LIMIT.md,
    types: [EntityType.ORG],
    ...SORT_INPUT[sort],
    focusAreaIds: focusAreaId ? [focusAreaId] : undefined,
    strategyIds: strategyId ? [strategyId] : undefined,
  };
};
