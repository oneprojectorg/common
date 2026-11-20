'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { InstancePhaseData } from '@op/api/encoders';
import { isReviewPhase } from '@op/common/client';
import { Header2 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { TableBody, TableHead, TableHeader, TableRow } from '@op/sense/Table';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useEffect } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from '../CategoryFilterSelect';
import { FilterBar, FilterBarEnd, FilterBarStart } from '../FilterBar';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { usesDistrictCategoryTerm } from '../categoryTerm';
import { ALL_CATEGORIES } from '../proposalFilterQuery';
import { ProposalReviewDecorationProvider } from '../proposalReviewDecoration';
import {
  CategoryFilterSkeleton,
  DevelopEntryCategoryCell,
} from './DevelopAdminEntriesPanel';
import { DevelopEntryTextCellSkeleton } from './DevelopEntriesParts';
import { NoSourcesEmpty } from './DevelopSourcesPanel';
import {
  DevelopSourceDecisionCell,
  DevelopSourceDecisionCellSkeleton,
  DevelopSourceEntryTitle,
  DevelopSourceNameCell,
  DevelopSourceNameCellSkeleton,
  DevelopSourceRecommendationsCell,
  DevelopSourceRecommendationsCellSkeleton,
  DevelopSourcesEmpty,
  DevelopSourcesNextPage,
  DevelopSourcesProvider,
  DevelopSourcesTable,
  useDevelopSources,
} from './DevelopSourcesParts';

// Not `category` or `entryCategory`, which the other lists on this route use.
const SOURCE_CATEGORY_PARAM = 'sourceCategory';

/**
 * The admin's All proposals tab: every source of the previous phase, with its
 * category, its reviewers' overall recommendation and whether it is advancing.
 * A source's title opens its entry, or prepares one when it has none.
 */
export function DevelopAdminSourcesPanel({
  processInstanceId,
  sourcePhase,
  decisionSlug,
}: {
  processInstanceId: string;
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions.develop');
  const [categoryParam] = useSourceCategoryParam();
  // Used as given so the list does not wait for the categories; the filter
  // clears an unknown id once they load.
  const categoryId =
    categoryParam === ALL_CATEGORIES ? undefined : categoryParam;

  // A develop phase that opens the process has nothing to develop from.
  if (!sourcePhase) {
    return (
      <div className="flex flex-col gap-10">
        <div className="flex min-h-11 items-center">
          <Header2 className="text-title font-normal">
            {t('sourcesCount', { count: 0 })}
          </Header2>
        </div>
        <NoSourcesEmpty scope="all" />
      </div>
    );
  }

  return (
    <ProposalReviewDecorationProvider
      processInstanceId={processInstanceId}
      decisionSlug={decisionSlug}
      phaseId={sourcePhase.phaseId}
      enabled={isReviewPhase(sourcePhase)}
      canOpenReviews={false}
    >
      <DevelopSourcesProvider
        processInstanceId={processInstanceId}
        sourcePhaseId={sourcePhase.phaseId}
        scope="all"
        categoryId={categoryId}
        decisionSlug={decisionSlug}
      >
        <div className="flex flex-col gap-10">
          <FilterBar>
            <FilterBarStart>
              {/* Outside Suspense so the live region exists before the count changes. */}
              <div role="status" aria-live="polite">
                <APIErrorBoundary fallbacks={{ default: () => null }}>
                  <Suspense
                    fallback={
                      <Skeleton aria-hidden className="h-7 w-72 max-w-full" />
                    }
                  >
                    <DevelopAdminSourcesCountSuspense
                      processInstanceId={processInstanceId}
                      decisionSlug={decisionSlug}
                    />
                  </Suspense>
                </APIErrorBoundary>
              </div>
            </FilterBarStart>
            <FilterBarEnd>
              <APIErrorBoundary fallbacks={{ default: () => null }}>
                <Suspense fallback={<CategoryFilterSkeleton />}>
                  <DevelopAdminSourceCategoryFilterSuspense
                    processInstanceId={processInstanceId}
                    decisionSlug={decisionSlug}
                  />
                </Suspense>
              </APIErrorBoundary>
            </FilterBarEnd>
          </FilterBar>

          <APIErrorBoundary
            fallbacks={{ default: () => <ProposalsLoadError /> }}
          >
            <Suspense
              fallback={
                <DevelopAdminSourcesTableSkeleton decisionSlug={decisionSlug} />
              }
            >
              <DevelopAdminSourcesTableSuspense decisionSlug={decisionSlug} />
            </Suspense>
          </APIErrorBoundary>
        </div>
      </DevelopSourcesProvider>
    </ProposalReviewDecorationProvider>
  );
}

// The categories and the list are the filter's and the table's reads, so this
// adds no request.
function DevelopAdminSourcesCountSuspense({
  processInstanceId,
  decisionSlug,
}: {
  processInstanceId: string;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions.develop');
  const [{ items: categories }] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId,
  });
  const { total: count, categoryId } = useDevelopSources();
  const category = categoryId
    ? categories.find((item) => item.id === categoryId)
    : undefined;

  if (category) {
    return (
      <Header2 className="text-title font-normal">
        {t.rich('sourcesInCategoryCount', {
          count,
          category: category.name,
          bdi: (chunks) => <bdi>{chunks}</bdi>,
        })}
      </Header2>
    );
  }

  if (categoryId || categories.length === 0) {
    return (
      <Header2 className="text-title font-normal">
        {t('sourcesCount', { count })}
      </Header2>
    );
  }

  return (
    <Header2 className="text-title font-normal">
      {usesDistrictCategoryTerm(decisionSlug)
        ? t('sourcesAcrossDistrictsCount', {
            count,
            categories: categories.length,
          })
        : t('sourcesAcrossCategoriesCount', {
            count,
            categories: categories.length,
          })}
    </Header2>
  );
}

function DevelopAdminSourceCategoryFilterSuspense({
  processInstanceId,
  decisionSlug,
}: {
  processInstanceId: string;
  decisionSlug: string;
}) {
  const [{ items: categories }] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId,
  });
  const [categoryParam, setCategoryParam] = useSourceCategoryParam();
  const isKnownCategory =
    categoryParam === ALL_CATEGORIES ||
    categories.some((category) => category.id === categoryParam);

  // The param is untrusted: drop an id that names no category.
  useEffect(() => {
    if (!isKnownCategory) {
      void setCategoryParam(null);
    }
  }, [isKnownCategory, setCategoryParam]);

  return (
    <CategoryFilterSelect
      decisionSlug={decisionSlug}
      categories={categories}
      selectedCategory={isKnownCategory ? categoryParam : ALL_CATEGORIES}
      onSelectCategory={(category) => {
        void setCategoryParam(category === ALL_CATEGORIES ? null : category);
      }}
      className="w-full sm:w-48"
    />
  );
}

function DevelopAdminSourcesTableSuspense({
  decisionSlug,
}: {
  decisionSlug: string;
}) {
  const t = useTranslations('decisions.develop');
  const { sources } = useDevelopSources();

  if (sources.length === 0) {
    return (
      <DevelopSourcesEmpty
        narrowedDescription={
          usesDistrictCategoryTerm(decisionSlug)
            ? t('noFilteredSourcesDistrictDescription')
            : t('noFilteredSourcesDescription')
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <DevelopSourcesTable>
        <DevelopAdminSourcesTableHeader decisionSlug={decisionSlug} />
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.id}>
              <DevelopSourceNameCell source={source}>
                <DevelopSourceEntryTitle source={source} />
              </DevelopSourceNameCell>
              <DevelopEntryCategoryCell entry={source} />
              <DevelopSourceRecommendationsCell source={source} />
              <DevelopSourceDecisionCell source={source} />
            </TableRow>
          ))}
        </TableBody>
      </DevelopSourcesTable>

      <DevelopSourcesNextPage>
        {/* No header row here, so the cells carry the column widths. */}
        <DevelopSourcesTable>
          <TableBody>
            <DevelopAdminSourceSkeletonRows count={2} />
          </TableBody>
        </DevelopSourcesTable>
      </DevelopSourcesNextPage>
    </div>
  );
}

// Shared with the skeleton so its columns and height match.
function DevelopAdminSourcesTableHeader({
  decisionSlug,
}: {
  decisionSlug: string;
}) {
  const t = useTranslations('decisions');

  return (
    <TableHeader>
      <TableRow>
        <TableHead scope="col">{t('develop.nameColumn')}</TableHead>
        <TableHead scope="col" className="w-48">
          {usesDistrictCategoryTerm(decisionSlug)
            ? t('develop.districtColumn')
            : t('develop.categoryColumn')}
        </TableHead>
        <TableHead scope="col" className="w-72">
          {t('review.overallRecommendationLabel')}
        </TableHead>
        <TableHead scope="col" className="w-48 text-end">
          {t('develop.decisionColumn')}
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function DevelopAdminSourceSkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <TableRow key={index}>
          <DevelopSourceNameCellSkeleton />
          <DevelopEntryTextCellSkeleton className="w-48" />
          <DevelopSourceRecommendationsCellSkeleton className="w-72" />
          <DevelopSourceDecisionCellSkeleton className="w-48" />
        </TableRow>
      ))}
    </>
  );
}

function DevelopAdminSourcesTableSkeleton({
  decisionSlug,
}: {
  decisionSlug: string;
}) {
  return (
    <div className="flex flex-col" aria-hidden>
      <DevelopSourcesTable>
        <DevelopAdminSourcesTableHeader decisionSlug={decisionSlug} />
        <TableBody>
          <DevelopAdminSourceSkeletonRows count={4} />
        </TableBody>
      </DevelopSourcesTable>
    </div>
  );
}

function useSourceCategoryParam() {
  return useQueryState(
    SOURCE_CATEGORY_PARAM,
    parseAsString.withDefault(ALL_CATEGORIES),
  );
}
