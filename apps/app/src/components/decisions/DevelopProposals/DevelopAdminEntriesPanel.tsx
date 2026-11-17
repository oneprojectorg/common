'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
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
import { ProposalsLoadError } from '../ProposalsLoadError';
import { usesDistrictCategoryTerm } from '../categoryTerm';
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

/** The URL param of the entries' category filter, apart from the proposals list's. */
const ENTRY_CATEGORY_PARAM = 'entryCategory';

/**
 * The body of the admin's develop screen: a count of the develop phase's
 * entries, a search and a category filter, and the entries with their
 * category, budget and status. The API filters, searches and pages; the
 * category filter is kept in the URL.
 *
 * The count, the category filter and the table suspend on their own data
 * under sibling boundaries, so their requests start together.
 */
export function DevelopAdminEntriesPanel({
  processInstanceId,
  phaseId,
  decisionSlug,
  entryName,
}: {
  processInstanceId: string;
  /** The develop phase, whose entries are listed. */
  phaseId: string | undefined;
  decisionSlug: string;
  entryName: string;
}) {
  const [categoryParam] = useEntryCategoryParam();
  // The list takes the param as given, without waiting for the categories:
  // an id this process does not have matches nothing until the filter, once
  // the categories load, clears it.
  const categoryId =
    categoryParam === ALL_CATEGORIES ? undefined : categoryParam;

  return (
    <DevelopEntriesProvider
      processInstanceId={processInstanceId}
      phaseId={phaseId}
      categoryId={categoryId}
    >
      <div className="flex flex-col gap-10">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
          {/* Filtering swaps the rows in place, so the count is the only
              feedback a screen reader gets that a search or filter landed. */}
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

          <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
            <DevelopEntriesSearch />
            <APIErrorBoundary fallbacks={{ default: () => null }}>
              <Suspense fallback={<CategoryFilterSkeleton />}>
                <DevelopAdminCategoryFilterSuspense
                  processInstanceId={processInstanceId}
                  decisionSlug={decisionSlug}
                />
              </Suspense>
            </APIErrorBoundary>
          </div>
        </div>

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
              decisionSlug={decisionSlug}
              entryName={entryName}
            />
          </Suspense>
        </APIErrorBoundary>
      </div>
    </DevelopEntriesProvider>
  );
}

/**
 * "12 entries", or "3 of 12 entries" once a search or category narrows the
 * list, in the shape of the proposals list's count.
 */
function DevelopAdminEntriesCountSuspense({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
}) {
  const t = useTranslations('decisions.develop');
  // The unfiltered total is the "of N"; only `.total` is read, so the list is
  // asked for one row. It is read before the list so both requests start in
  // the first render: the table, a sibling, has already started the list's.
  const [{ total: unfilteredTotal }] =
    trpc.decision.listProposals.useSuspenseQuery({
      processInstanceId,
      phaseId,
      limit: 1,
    });
  const { total: count } = useDevelopEntries();

  // The two totals come from separately cached queries, and a realtime
  // refresh can land on one before the other. A count at or above the total
  // stands alone, so the heading never reads "13 of 12".
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

  // The param is untrusted. Once the categories are known, one that names
  // none of them is dropped, and the list goes back to every category.
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
  decisionSlug,
  entryName,
}: {
  decisionSlug: string;
  entryName: string;
}) {
  const t = useTranslations();
  const { entries } = useDevelopEntries();

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
      <DevelopEntriesTable entryName={entryName}>
        <DevelopAdminEntriesTableHeader
          entryName={entryName}
          decisionSlug={decisionSlug}
        />
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <DevelopEntryTitleCell
                entry={entry}
                decisionSlug={decisionSlug}
              />
              <DevelopEntryCategoryCell entry={entry} />
              <DevelopEntryBudgetCell entry={entry} />
              <DevelopEntryStatusCell entry={entry} />
            </TableRow>
          ))}
        </TableBody>
      </DevelopEntriesTable>

      <DevelopEntriesNextPage>
        {/* No header row here, so the cells carry the column widths. */}
        <DevelopEntriesTable entryName={entryName}>
          <TableBody>
            <DevelopAdminEntrySkeletonRows count={2} />
          </TableBody>
        </DevelopEntriesTable>
      </DevelopEntriesNextPage>
    </div>
  );
}

/** The real header, so the skeleton's columns and height match the table's. */
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

/** The category labels the entry's proposal data holds, as other lists show them. */
function DevelopEntryCategoryCell({ entry }: { entry: Proposal }) {
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

/** The category filter's trigger: full width up to 12rem below `sm`, 12rem above. */
function CategoryFilterSkeleton() {
  return <Skeleton aria-hidden className="h-11 w-full max-w-48 sm:w-48" />;
}

function useEntryCategoryParam() {
  return useQueryState(
    ENTRY_CATEGORY_PARAM,
    parseAsString.withDefault(ALL_CATEGORIES),
  );
}
