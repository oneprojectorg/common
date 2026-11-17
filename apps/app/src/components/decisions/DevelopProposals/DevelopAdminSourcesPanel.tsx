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
import { ProposalsLoadError } from '../ProposalsLoadError';
import { usesDistrictCategoryTerm } from '../categoryTerm';
import { ALL_CATEGORIES } from '../proposalFilterQuery';
import { ProposalReviewDecorationProvider } from '../proposalReviewDecoration';
import {
  CategoryFilterSkeleton,
  DevelopEntryCategoryCell,
} from './DevelopAdminEntriesPanel';
import {
  DevelopEntryStatusCellSkeleton,
  DevelopEntryTextCellSkeleton,
} from './DevelopEntriesParts';
import { NoSourcesEmpty } from './DevelopSourcesPanel';
import {
  DevelopSourceActionCell,
  DevelopSourceActionCellSkeleton,
  DevelopSourceDecisionCell,
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
 * category, its reviewers' overall recommendation, whether it is advancing,
 * and an action that opens its entry or prepares one.
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
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
            {/* Outside Suspense so the live region exists before the count changes. */}
            <div role="status" aria-live="polite">
              <APIErrorBoundary fallbacks={{ default: () => null }}>
                <Suspense
                  fallback={<Skeleton aria-hidden className="h-7 w-40" />}
                >
                  <DevelopAdminSourcesCountSuspense
                    processInstanceId={processInstanceId}
                    sourcePhaseId={sourcePhase.phaseId}
                  />
                </Suspense>
              </APIErrorBoundary>
            </div>

            <APIErrorBoundary fallbacks={{ default: () => null }}>
              <Suspense fallback={<CategoryFilterSkeleton />}>
                <DevelopAdminSourceCategoryFilterSuspense
                  processInstanceId={processInstanceId}
                  decisionSlug={decisionSlug}
                />
              </Suspense>
            </APIErrorBoundary>
          </div>

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

// Same shape as the entries tab's count.
function DevelopAdminSourcesCountSuspense({
  processInstanceId,
  sourcePhaseId,
}: {
  processInstanceId: string;
  sourcePhaseId: string;
}) {
  const t = useTranslations('decisions.develop');
  // Only `.total` is read, hence `limit: 1`. Read before the list so it
  // starts in the same render as the table's list request.
  const [{ total: unfilteredTotal }] =
    trpc.decision.listDevelopSources.useSuspenseQuery({
      processInstanceId,
      phaseIds: [sourcePhaseId],
      scope: 'all',
      limit: 1,
    });
  const { total: count } = useDevelopSources();

  // The totals are cached apart and can refresh out of step; `>=` keeps a
  // "13 of 12" from showing.
  if (count >= unfilteredTotal) {
    return (
      <Header2 className="text-title font-normal">
        {t('sourcesCount', { count })}
      </Header2>
    );
  }

  return (
    <span className="flex items-baseline gap-1">
      <Header2 className="text-title font-normal">{count}</Header2>
      <span className="text-base text-muted-foreground">
        {t('ofTotalSources', { total: unfilteredTotal })}
      </span>
    </span>
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
              <DevelopSourceNameCell source={source} />
              <DevelopEntryCategoryCell entry={source} />
              <DevelopSourceRecommendationsCell source={source} />
              <DevelopSourceDecisionCell source={source} />
              <DevelopSourceActionCell source={source} />
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
        <TableHead scope="col" className="w-40">
          {usesDistrictCategoryTerm(decisionSlug)
            ? t('develop.districtColumn')
            : t('develop.categoryColumn')}
        </TableHead>
        <TableHead scope="col" className="w-72">
          {t('review.overallRecommendationLabel')}
        </TableHead>
        <TableHead scope="col" className="w-48">
          {t('develop.decisionColumn')}
        </TableHead>
        <TableHead scope="col" className="w-36 text-end">
          <span className="sr-only">{t('develop.actionsColumn')}</span>
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
          <DevelopEntryTextCellSkeleton className="w-40" />
          <DevelopSourceRecommendationsCellSkeleton className="w-72" />
          <DevelopEntryStatusCellSkeleton className="w-48" />
          <DevelopSourceActionCellSkeleton className="w-36" />
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
