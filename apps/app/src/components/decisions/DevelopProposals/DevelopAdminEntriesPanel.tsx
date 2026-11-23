'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Header2 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useEffect } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from '../CategoryFilterSelect';
import { FilterBar, FilterBarEnd, FilterBarStart } from '../FilterBar';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { usesDistrictCategoryTerm } from '../categoryTerm';
import { getSchemaName } from '../getSchemaName';
import { ALL_CATEGORIES } from '../proposalFilterQuery';
import {
  DevelopEntriesEmpty,
  DevelopEntriesNextPage,
  DevelopEntriesProvider,
  DevelopEntriesSearch,
  DevelopEntriesTable,
  DevelopEntryBudgetCell,
  DevelopEntryStatusCell,
  DevelopEntryStatusCellSkeleton,
  DevelopEntryTextCellSkeleton,
  DevelopEntryTitleCell,
  DevelopEntryTitleCellSkeleton,
  useDevelopEntries,
} from './DevelopEntriesParts';
import { getCategoryConfirmedAt } from './developCategoryStatus';

// Not `category`, which the proposals list uses.
const ENTRY_CATEGORY_PARAM = 'entryCategory';

export function DevelopAdminEntriesPanel({
  processInstanceId,
  phaseId,
  decisionSlug,
  entryName,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  decisionSlug: string;
  entryName: string;
}) {
  const [categoryParam] = useEntryCategoryParam();
  // Used as given so the list does not wait for the categories; the filter
  // clears an unknown id once they load.
  const categoryId =
    categoryParam === ALL_CATEGORIES ? undefined : categoryParam;

  return (
    <DevelopEntriesProvider
      processInstanceId={processInstanceId}
      phaseId={phaseId}
      categoryId={categoryId}
    >
      <div className="flex flex-col gap-10">
        <FilterBar>
          <FilterBarStart>
            {/* Outside Suspense so the live region exists before the count changes. */}
            <div role="status" aria-live="polite">
              <APIErrorBoundary fallbacks={{ default: () => null }}>
                <Suspense
                  fallback={<Skeleton aria-hidden className="h-7 w-40" />}
                >
                  <DevelopAdminEntriesCountSuspense
                    processInstanceId={processInstanceId}
                    phaseId={phaseId}
                  />
                </Suspense>
              </APIErrorBoundary>
            </div>
            <DevelopEntriesSearch />
          </FilterBarStart>
          <FilterBarEnd>
            <APIErrorBoundary fallbacks={{ default: () => null }}>
              <Suspense fallback={<CategoryFilterSkeleton />}>
                <DevelopAdminCategoryFilterSuspense
                  processInstanceId={processInstanceId}
                  decisionSlug={decisionSlug}
                />
              </Suspense>
            </APIErrorBoundary>
          </FilterBarEnd>
        </FilterBar>

        <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
          <Suspense
            fallback={
              <DevelopAdminEntriesTableSkeleton
                entryName={entryName}
                decisionSlug={decisionSlug}
              />
            }
          >
            <DevelopAdminEntriesTableSuspense
              processInstanceId={processInstanceId}
              decisionSlug={decisionSlug}
              entryName={entryName}
            />
          </Suspense>
        </APIErrorBoundary>
      </div>
    </DevelopEntriesProvider>
  );
}

// Same shape as the proposals list's `ProposalCount`.
function DevelopAdminEntriesCountSuspense({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
}) {
  const t = useTranslations('decisions.develop');
  // Only `.total` is read, hence `limit: 1`. Read before the list so it
  // starts in the same render as the table's list request.
  const [{ total: unfilteredTotal }] =
    trpc.decision.listProposals.useSuspenseQuery({
      processInstanceId,
      phaseId,
      status: ProposalStatus.SUBMITTED,
      limit: 1,
    });
  const { total: count } = useDevelopEntries();

  // The totals are cached apart and can refresh out of step; `>=` keeps a
  // "13 of 12" from showing.
  if (count >= unfilteredTotal) {
    return (
      <Header2 className="text-title font-normal">
        {t('entriesCount', { count })}
      </Header2>
    );
  }

  return (
    <span className="flex items-baseline gap-1">
      <Header2 className="text-title font-normal">{count}</Header2>
      <span className="text-base text-muted-foreground">
        {t('ofTotalEntries', { total: unfilteredTotal })}
      </span>
    </span>
  );
}

function DevelopAdminCategoryFilterSuspense({
  processInstanceId,
  decisionSlug,
}: {
  processInstanceId: string;
  decisionSlug: string;
}) {
  const [{ items: categories }] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId,
  });
  const [categoryParam, setCategoryParam] = useEntryCategoryParam();
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

function DevelopAdminEntriesTableSuspense({
  processInstanceId,
  decisionSlug,
  entryName,
}: {
  processInstanceId: string;
  decisionSlug: string;
  entryName: string;
}) {
  const t = useTranslations();
  const { entries } = useDevelopEntries();
  const schemaName = getSchemaName({
    template: entries[0]?.proposalTemplate ?? null,
    fallback: entryName,
  });
  const [{ items: categoryStatuses }] =
    trpc.decision.listCategoryReviewerStatus.useSuspenseQuery({
      processInstanceId,
    });
  const confirmedCategoryNames = new Set(
    categoryStatuses
      .filter((status) => getCategoryConfirmedAt(status) !== null)
      .map((status) => status.category.name),
  );

  if (entries.length === 0) {
    return (
      <DevelopEntriesEmpty
        narrowedDescription={
          usesDistrictCategoryTerm(decisionSlug)
            ? t('decisions.develop.noFilteredEntriesDistrictDescription')
            : t('decisions.develop.noFilteredEntriesDescription')
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <DevelopEntriesTable entryName={schemaName}>
        <DevelopAdminEntriesTableHeader
          entryName={schemaName}
          decisionSlug={decisionSlug}
        />
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <DevelopEntryTitleCell
                entry={entry}
                decisionSlug={decisionSlug}
                isEditable={entry.isEditable === true}
              />
              <DevelopEntryCategoryCell entry={entry} />
              <DevelopEntryBudgetCell entry={entry} />
              <DevelopEntryStatusCell
                isCategoryConfirmed={isEntryCategoryConfirmed({
                  entry,
                  confirmedCategoryNames,
                })}
              />
            </TableRow>
          ))}
        </TableBody>
      </DevelopEntriesTable>

      <DevelopEntriesNextPage>
        {/* No header row here, so the cells carry the column widths. */}
        <DevelopEntriesTable entryName={schemaName}>
          <TableBody>
            <DevelopAdminEntrySkeletonRows count={2} />
          </TableBody>
        </DevelopEntriesTable>
      </DevelopEntriesNextPage>
    </div>
  );
}

// Shared with the skeleton so its columns and height match.
function DevelopAdminEntriesTableHeader({
  entryName,
  decisionSlug,
}: {
  entryName: string;
  decisionSlug: string;
}) {
  const t = useTranslations();

  return (
    <TableHeader>
      <TableRow>
        <TableHead scope="col">
          <bdi>{entryName}</bdi>
        </TableHead>
        <TableHead scope="col" className="w-48">
          {usesDistrictCategoryTerm(decisionSlug)
            ? t('decisions.develop.districtColumn')
            : t('decisions.develop.categoryColumn')}
        </TableHead>
        <TableHead scope="col" className="w-30">
          {t('decisions.budgetLabel')}
        </TableHead>
        <TableHead scope="col" className="w-45">
          {t('decisions.develop.statusColumn')}
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function DevelopEntryCategoryCell({ entry }: { entry: Proposal }) {
  const format = useFormatter();
  const categories = entry.proposalData.category;

  return (
    <TableCell className="py-4">
      {categories.length > 0 ? (
        <span
          dir="auto"
          className="block truncate ltr:text-left rtl:text-right"
        >
          {format.list(
            categories.map((category) => <bdi key={category}>{category}</bdi>),
            { type: 'unit' },
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  );
}

// An entry holds its category labels, which are the category names.
function isEntryCategoryConfirmed({
  entry,
  confirmedCategoryNames,
}: {
  entry: Proposal;
  confirmedCategoryNames: Set<string>;
}) {
  const categories = entry.proposalData.category;
  return (
    categories.length > 0 &&
    categories.every((category) => confirmedCategoryNames.has(category))
  );
}

function DevelopAdminEntrySkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <TableRow key={index}>
          <DevelopEntryTitleCellSkeleton />
          <DevelopEntryTextCellSkeleton className="w-48" />
          <DevelopEntryTextCellSkeleton className="w-30" />
          <DevelopEntryStatusCellSkeleton className="w-45" />
        </TableRow>
      ))}
    </>
  );
}

function DevelopAdminEntriesTableSkeleton({
  entryName,
  decisionSlug,
}: {
  entryName: string;
  decisionSlug: string;
}) {
  return (
    <div className="flex flex-col" aria-hidden>
      <DevelopEntriesTable entryName={entryName}>
        <DevelopAdminEntriesTableHeader
          entryName={entryName}
          decisionSlug={decisionSlug}
        />
        <TableBody>
          <DevelopAdminEntrySkeletonRows count={4} />
        </TableBody>
      </DevelopEntriesTable>
    </div>
  );
}

// ResponsiveSelect caps its phone trigger at 12rem.
export function CategoryFilterSkeleton() {
  return <Skeleton aria-hidden className="h-11 w-full max-w-48 sm:w-48" />;
}

function useEntryCategoryParam() {
  return useQueryState(
    ENTRY_CATEGORY_PARAM,
    parseAsString.withDefault(ALL_CATEGORIES),
  );
}
