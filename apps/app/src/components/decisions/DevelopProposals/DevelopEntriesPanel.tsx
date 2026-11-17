'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { TableBody, TableHead, TableHeader, TableRow } from '@op/sense/Table';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalsLoadError } from '../ProposalsLoadError';
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
  return (
    <DevelopEntriesProvider
      processInstanceId={processInstanceId}
      phaseId={phaseId}
    >
      <div className="flex flex-col gap-10">
        <div className="flex min-h-11 items-center justify-end">
          <DevelopEntriesSearch />
        </div>

        <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
          <Suspense
            fallback={<DevelopEntriesTableSkeleton entryName={entryName} />}
          >
            <DevelopEntriesTableSuspense
              decisionSlug={decisionSlug}
              entryName={entryName}
            />
          </Suspense>
        </APIErrorBoundary>
      </div>
    </DevelopEntriesProvider>
  );
}

function DevelopEntriesTableSuspense({
  decisionSlug,
  entryName,
}: {
  decisionSlug: string;
  entryName: string;
}) {
  const t = useTranslations();
  const { entries, total } = useDevelopEntries();

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
          narrowedDescription={t(
            'decisions.develop.noMatchingEntriesDescription',
          )}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {resultsCount}
      <DevelopEntriesTable entryName={entryName}>
        <DevelopEntriesTableHeader entryName={entryName} />
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
      </DevelopEntriesTable>

      <DevelopEntriesNextPage>
        {/* No header row here, so the cells carry the column widths. */}
        <DevelopEntriesTable entryName={entryName}>
          <TableBody>
            <DevelopEntrySkeletonRows count={2} />
          </TableBody>
        </DevelopEntriesTable>
      </DevelopEntriesNextPage>
    </div>
  );
}

// Shared with the skeleton so its columns and height match.
function DevelopEntriesTableHeader({ entryName }: { entryName: string }) {
  const t = useTranslations();

  return (
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
  );
}

function DevelopEntrySkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <TableRow key={index}>
          <DevelopEntryTitleCellSkeleton />
          <DevelopEntryTextCellSkeleton className="w-30" />
          <DevelopEntryStatusCellSkeleton className="w-45" />
        </TableRow>
      ))}
    </>
  );
}

function DevelopEntriesTableSkeleton({ entryName }: { entryName: string }) {
  return (
    <div className="flex flex-col" aria-hidden>
      <DevelopEntriesTable entryName={entryName}>
        <DevelopEntriesTableHeader entryName={entryName} />
        <TableBody>
          <DevelopEntrySkeletonRows count={4} />
        </TableBody>
      </DevelopEntriesTable>
    </div>
  );
}
