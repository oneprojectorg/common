'use client';

import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import { type Proposal, nextCursor } from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { TableCell, TableRowHeader } from '@op/sense/Table';
import { type RefCallback, useCallback, useMemo } from 'react';
import { LuFileText, LuSearch } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';
import {
  decisionProposalDevelopHref,
  decisionProposalHref,
} from '../proposalHrefs';

/** What the Entries tab lists: the develop phase's entries, narrowed in the API. */
export interface DevelopEntriesQuery {
  processInstanceId: string;
  /** The develop phase, whose entries are listed. */
  phaseId: string | undefined;
  search: string;
}

// The shared pieces of the develop screen's Entries tab: the query, the search
// box, the cells of an entry row, the empty state, the next-page trigger and
// the skeleton. Each variant of the tab composes its own table from them.

/** One page-by-page read of the entries; the API searches and pages. */
export function useDevelopEntriesQuery({
  processInstanceId,
  phaseId,
  search,
}: DevelopEntriesQuery) {
  return trpc.decision.listProposals.useSuspenseInfiniteQuery(
    {
      processInstanceId,
      phaseId,
      search: search || undefined,
      limit: PROPOSALS_PAGE_LIMIT,
    },
    { getNextPageParam: nextCursor },
  );
}

/** The entries loaded so far, their total, and the next-page trigger. */
export function useDevelopEntries(query: DevelopEntriesQuery) {
  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    useDevelopEntriesQuery(query);

  const entries = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  const loadNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const { ref: nextPageRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
    });

  return {
    entries,
    total: data.pages[0]?.total ?? 0,
    nextPageRef,
    shouldShowTrigger,
    isFetchingNextPage,
  };
}

export function DevelopEntriesSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();

  return (
    <InputGroup className="w-full sm:w-56">
      <InputGroupAddon align="inline-start">
        <LuSearch aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('Search')}
        aria-label={t('decisions.develop.searchEntriesLabel')}
      />
    </InputGroup>
  );
}

/**
 * The entry's title. An entry its caller may still edit opens in the develop
 * editor; any other opens read-only.
 */
export function DevelopEntryTitleCell({
  entry,
  decisionSlug,
}: {
  entry: Proposal;
  decisionSlug: string;
}) {
  const t = useTranslations();
  const openInSheet = useOpenProposalInSheet();
  const title = entry.profile.name || t('decisions.develop.untitledEntry');

  return (
    <TableRowHeader className="py-4">
      <Link
        href={
          entry.isEditable
            ? decisionProposalDevelopHref({
                decisionSlug,
                profileId: entry.profileId,
              })
            : decisionProposalHref({
                decisionSlug,
                profileId: entry.profileId,
              })
        }
        onClick={entry.isEditable ? undefined : openInSheet(entry.profileId)}
        dir="auto"
        className="block truncate text-base font-strong text-foreground hover:underline ltr:text-left rtl:text-right"
      >
        {title}
      </Link>
    </TableRowHeader>
  );
}

export function DevelopEntryBudgetCell({ entry }: { entry: Proposal }) {
  const budget = entry.proposalData.budget;

  return (
    <TableCell className="py-4 tabular-nums">
      {budget ? (
        formatCurrency(budget.amount, undefined, budget.currency)
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  );
}

export function DevelopEntryStatusCell({ entry }: { entry: Proposal }) {
  const t = useTranslations();
  const isDraft = entry.status === ProposalStatus.DRAFT;

  return (
    <TableCell className="py-4">
      <StatusBadge variant={isDraft ? 'in-progress' : 'success'} icon={false}>
        {isDraft
          ? t('decisions.develop.entryInProgressStatus')
          : t('decisions.develop.entryAdvancingStatus')}
      </StatusBadge>
    </TableCell>
  );
}

export function DevelopEntriesEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuFileText aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle render={<h3 />}>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Loads the next page when it scrolls into view. */
export function DevelopEntriesNextPage({
  nextPageRef,
  isFetchingNextPage,
}: {
  nextPageRef: RefCallback<HTMLDivElement>;
  isFetchingNextPage: boolean;
}) {
  return (
    <div ref={nextPageRef} aria-hidden className="flex flex-col">
      {isFetchingNextPage
        ? Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 border-b py-4"
            >
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-9 w-28" />
            </div>
          ))
        : null}
    </div>
  );
}

export function DevelopEntriesTableSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 border-b py-4"
        >
          <Skeleton className="h-4 w-64" />
          <div className="flex items-center gap-10">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
