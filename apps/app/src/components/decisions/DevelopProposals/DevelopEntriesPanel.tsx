'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { Proposal } from '@op/common/client';
import { TableBody, TableHead, TableHeader, TableRow } from '@op/sense/Table';
import { type ReactNode, Suspense } from 'react';

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

interface DevelopEntriesPanelProps {
  processInstanceId: string;
  /** The develop phase, whose entries are listed. */
  phaseId: string | undefined;
  decisionSlug: string;
  entryName: string;
}

/**
 * The Entries tab of the develop screen: the entries advancing from this
 * phase, with their budget. The caller has not confirmed their work, so
 * each category is still deliberating. The search runs in the API, page by
 * page, like the list itself.
 */
export function DevelopEntriesPanel(props: DevelopEntriesPanelProps) {
  return (
    <EntriesPanel
      {...props}
      isEntryEditable={(entry) => entry.isEditable === true}
      renderStatusCell={() => (
        <DevelopEntryStatusCell isCategoryConfirmed={false} />
      )}
    />
  );
}

/**
 * The Entries tab once the caller confirmed their work or the window
 * closed: each entry opens read-only.
 */
export function DevelopEntriesReadOnlyPanel({
  isCategoryConfirmed,
  ...props
}: DevelopEntriesPanelProps & {
  /** Whether the caller confirmed their work, which confirms their categories. */
  isCategoryConfirmed: boolean;
}) {
  return (
    <EntriesPanel
      {...props}
      isEntryEditable={() => false}
      renderStatusCell={() => (
        <DevelopEntryStatusCell isCategoryConfirmed={isCategoryConfirmed} />
      )}
    />
  );
}

function EntriesPanel({
  processInstanceId,
  phaseId,
  decisionSlug,
  entryName,
  isEntryEditable,
  renderStatusCell,
}: DevelopEntriesPanelProps & {
  isEntryEditable: (entry: Proposal) => boolean;
  renderStatusCell: (entry: Proposal) => ReactNode;
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
              isEntryEditable={isEntryEditable}
              renderStatusCell={renderStatusCell}
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
  isEntryEditable,
  renderStatusCell,
}: {
  decisionSlug: string;
  entryName: string;
  isEntryEditable: (entry: Proposal) => boolean;
  renderStatusCell: (entry: Proposal) => ReactNode;
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
                isEditable={isEntryEditable(entry)}
              />
              <DevelopEntryBudgetCell entry={entry} />
              {renderStatusCell(entry)}
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
