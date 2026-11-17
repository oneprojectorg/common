'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { Header2 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useDeferredValue, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from '../CategoryFilterSelect';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { ALL_CATEGORIES } from '../proposalFilterQuery';
import {
  type DevelopEntriesQuery,
  DevelopEntriesEmpty,
  DevelopEntriesNextPage,
  DevelopEntriesSearch,
  DevelopEntriesTableSkeleton,
  DevelopEntryBudgetCell,
  DevelopEntryStatusCell,
  DevelopEntryTitleCell,
  useDevelopEntries,
  useDevelopEntriesQuery,
} from './DevelopEntriesParts';

/** The URL param of the entries' category filter, apart from the proposals list's. */
const ENTRY_CATEGORY_PARAM = 'entryCategory';

interface DevelopAdminEntriesPanelProps {
  processInstanceId: string;
  /** The develop phase, whose entries are listed. */
  phaseId: string | undefined;
  decisionSlug: string;
  entryName: string;
}

/**
 * The body of the admin's develop screen: a count of the develop phase's
 * entries, a search and a category filter, and the entries with their
 * category, budget and status. The API filters, searches and pages; the
 * category filter is kept in the URL.
 */
export function DevelopAdminEntriesPanel(props: DevelopAdminEntriesPanelProps) {
  return (
    <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
      <Suspense fallback={<DevelopAdminEntriesPanelSkeleton />}>
        <DevelopAdminEntriesPanelSuspense {...props} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function DevelopAdminEntriesPanelSuspense({
  processInstanceId,
  phaseId,
  decisionSlug,
  entryName,
}: DevelopAdminEntriesPanelProps) {
  const [{ items: categories }] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId,
  });

  const [categoryParam, setCategoryParam] = useQueryState(
    ENTRY_CATEGORY_PARAM,
    parseAsString.withDefault(ALL_CATEGORIES),
  );
  // The param is untrusted: an id this process does not have lists every
  // category.
  const selectedCategory = categories.some(
    (category) => category.id === categoryParam,
  )
    ? categoryParam
    : ALL_CATEGORIES;

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim(), 200);

  // Keeps the current rows and count on screen while the next search or
  // category loads, instead of swapping them for their skeletons.
  const deferredSearch = useDeferredValue(debouncedSearch);
  const deferredCategory = useDeferredValue(selectedCategory);
  const query: DevelopEntriesQuery = {
    processInstanceId,
    phaseId,
    search: deferredSearch,
    categoryId:
      deferredCategory === ALL_CATEGORIES ? undefined : deferredCategory,
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
        <div aria-live="polite">
          <APIErrorBoundary fallbacks={{ default: () => null }}>
            <Suspense fallback={<Skeleton className="h-7 w-40" />}>
              <DevelopEntriesCountSuspense query={query} />
            </Suspense>
          </APIErrorBoundary>
        </div>

        <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
          <DevelopEntriesSearch value={search} onChange={setSearch} />
          <CategoryFilterSelect
            decisionSlug={decisionSlug}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={(category) => {
              void setCategoryParam(
                category === ALL_CATEGORIES ? null : category,
              );
            }}
            className="w-full sm:w-48"
          />
        </div>
      </div>

      <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
        <Suspense fallback={<DevelopEntriesTableSkeleton />}>
          <DevelopAdminEntriesTableSuspense
            query={query}
            decisionSlug={decisionSlug}
            entryName={entryName}
          />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

/** The heading count; it reads the table's own query, so one request serves both. */
function DevelopEntriesCountSuspense({
  query,
}: {
  query: DevelopEntriesQuery;
}) {
  const t = useTranslations('decisions.develop');
  const [data] = useDevelopEntriesQuery(query);

  return (
    <Header2 className="text-title font-normal">
      {t('entriesCount', { count: data.pages[0]?.total ?? 0 })}
    </Header2>
  );
}

function DevelopAdminEntriesTableSuspense({
  query,
  decisionSlug,
  entryName,
}: {
  query: DevelopEntriesQuery;
  decisionSlug: string;
  entryName: string;
}) {
  const t = useTranslations();
  const { entries, nextPageRef, shouldShowTrigger, isFetchingNextPage } =
    useDevelopEntries(query);

  if (entries.length === 0) {
    return (
      <DevelopEntriesEmpty
        title={
          query.search || query.categoryId
            ? t('No results')
            : t('decisions.develop.noEntriesTitle')
        }
        description={
          query.search || query.categoryId
            ? t('decisions.develop.noFilteredEntriesDescription')
            : t('decisions.develop.noEntriesDescription')
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <Table
        aria-label={entryName}
        className="min-w-3xl table-fixed [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
      >
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              <bdi>{entryName}</bdi>
            </TableHead>
            <TableHead scope="col" className="w-48">
              {t('decisions.develop.categoryColumn')}
            </TableHead>
            <TableHead scope="col" className="w-30">
              {t('decisions.budgetLabel')}
            </TableHead>
            <TableHead scope="col" className="w-45">
              {t('decisions.develop.statusColumn')}
            </TableHead>
          </TableRow>
        </TableHeader>
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
      </Table>

      {shouldShowTrigger ? (
        <DevelopEntriesNextPage
          nextPageRef={nextPageRef}
          isFetchingNextPage={isFetchingNextPage}
        />
      ) : null}
    </div>
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

function DevelopAdminEntriesPanelSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-7 w-40" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-56" />
          <Skeleton className="h-11 w-48" />
        </div>
      </div>
      <DevelopEntriesTableSkeleton />
    </div>
  );
}
