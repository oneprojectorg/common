'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useDebounce } from '@op/hooks';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { Suspense, useDeferredValue, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalsLoadError } from '../ProposalsLoadError';
import {
  DevelopEntriesEmpty,
  DevelopEntriesNextPage,
  DevelopEntriesSearch,
  DevelopEntriesTableSkeleton,
  DevelopEntryBudgetCell,
  DevelopEntryStatusCell,
  DevelopEntryTitleCell,
  useDevelopEntries,
} from './DevelopEntriesParts';

/**
 * The Entries tab of the develop screen: the entries this phase holds, with
 * their budget and whether they are still in progress or advancing. The
 * search runs in the API, page by page, like the list itself.
 */
export function DevelopEntriesPanel({
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
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim(), 200);
  // Keeps the current rows on screen while the next search loads, instead of
  // swapping the table for its skeleton on every keystroke.
  const deferredSearch = useDeferredValue(debouncedSearch);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex min-h-11 items-center justify-end">
        <DevelopEntriesSearch value={search} onChange={setSearch} />
      </div>

      <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
        <Suspense fallback={<DevelopEntriesTableSkeleton />}>
          <DevelopEntriesTableSuspense
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            search={deferredSearch}
            decisionSlug={decisionSlug}
            entryName={entryName}
          />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function DevelopEntriesTableSuspense({
  processInstanceId,
  phaseId,
  search,
  decisionSlug,
  entryName,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  search: string;
  decisionSlug: string;
  entryName: string;
}) {
  const t = useTranslations();
  const { entries, total, nextPageRef, shouldShowTrigger, isFetchingNextPage } =
    useDevelopEntries({ processInstanceId, phaseId, search });

  const resultsCount = (
    <p aria-live="polite" className="sr-only">
      {t('decisions.develop.resultsCount', { count: total })}
    </p>
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col">
        {resultsCount}
        <DevelopEntriesEmpty
          title={
            search ? t('No results') : t('decisions.develop.noEntriesTitle')
          }
          description={
            search
              ? t('decisions.develop.noMatchingEntriesDescription')
              : t('decisions.develop.noEntriesDescription')
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {resultsCount}
      <Table
        aria-label={entryName}
        className="min-w-3xl table-fixed [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
      >
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              <bdi>{entryName}</bdi>
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
