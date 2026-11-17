'use client';

import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import { type Proposal, nextCursor } from '@op/common/client';
import { useDebounce, useInfiniteScroll } from '@op/hooks';
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
import { Table, TableCell, TableRowHeader } from '@op/sense/Table';
import { cn } from '@op/sense/lib/utils';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
  useState,
} from 'react';
import { LuFileText, LuSearch } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';
import {
  decisionProposalDevelopHref,
  decisionProposalHref,
} from '../proposalHrefs';

// The shared pieces of the develop screen's entries list. A variant wraps its
// screen in `DevelopEntriesProvider` and composes its own table from the
// parts below; each part reads the provider instead of taking the query.

/** The list's API inputs, as the provider applies them. */
interface DevelopEntriesQuery {
  processInstanceId: string;
  phaseId: string | undefined;
  search: string;
  categoryId: string | undefined;
}

interface DevelopEntriesContextValue {
  state: {
    /** The search box's text, as typed. */
    search: string;
  };
  actions: {
    setSearch: (search: string) => void;
  };
  meta: {
    /** What the list asks the API for: debounced and deferred. */
    query: DevelopEntriesQuery;
    /** A search or category narrows the list. */
    isNarrowed: boolean;
  };
}

const DevelopEntriesContext = createContext<DevelopEntriesContextValue | null>(
  null,
);

/**
 * Owns the entries list's search and its API inputs. The search and the
 * category reach the API debounced and deferred, so the current rows stay on
 * screen while the next ones load instead of swapping for their skeleton.
 */
export function DevelopEntriesProvider({
  processInstanceId,
  phaseId,
  categoryId,
  children,
}: {
  processInstanceId: string;
  /** The develop phase, whose entries are listed. */
  phaseId: string | undefined;
  /** Narrows the list to one category; omitted lists every category. */
  categoryId?: string;
  children: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim(), 200);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const deferredCategoryId = useDeferredValue(categoryId);

  const value: DevelopEntriesContextValue = {
    state: { search },
    actions: { setSearch },
    meta: {
      query: {
        processInstanceId,
        phaseId,
        search: deferredSearch,
        categoryId: deferredCategoryId,
      },
      isNarrowed: Boolean(deferredSearch || deferredCategoryId),
    },
  };

  return (
    <DevelopEntriesContext.Provider value={value}>
      {children}
    </DevelopEntriesContext.Provider>
  );
}

/**
 * The entries loaded so far, the API's total, and the next-page controls:
 * the one read of the list, shared by every part through the query cache.
 */
export function useDevelopEntries() {
  const { query } = useDevelopEntriesContext().meta;
  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId: query.processInstanceId,
        phaseId: query.phaseId,
        search: query.search || undefined,
        categoryId: query.categoryId,
        limit: PROPOSALS_PAGE_LIMIT,
      },
      { getNextPageParam: nextCursor },
    );

  // The React Compiler is not on in this app, so the flattened rows are
  // memoised by hand.
  const entries = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  return {
    entries,
    total: data.pages[0]?.total ?? 0,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
}

/** Whether a search or category narrows the list; it needs no data. */
export function useDevelopEntriesNarrowed() {
  return useDevelopEntriesContext().meta.isNarrowed;
}

export function DevelopEntriesSearch() {
  const t = useTranslations();
  const { state, actions } = useDevelopEntriesContext();

  return (
    <InputGroup className="w-full sm:w-56">
      <InputGroupAddon align="inline-start">
        <LuSearch aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={state.search}
        onChange={(event) => actions.setSearch(event.target.value)}
        placeholder={t('Search')}
        aria-label={t('decisions.develop.searchEntriesLabel')}
      />
    </InputGroup>
  );
}

/** The table frame every variant shares; the variant supplies its rows. */
export function DevelopEntriesTable({
  entryName,
  children,
}: {
  entryName: string;
  children: ReactNode;
}) {
  return (
    <Table
      aria-label={entryName}
      className="min-w-3xl table-fixed [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
    >
      {children}
    </Table>
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

/**
 * The empty list. Its title and description tell an unfiltered list apart
 * from a narrowed one; the variant supplies the narrowed description.
 */
export function DevelopEntriesEmpty({
  narrowedDescription,
}: {
  narrowedDescription: string;
}) {
  const t = useTranslations();
  const isNarrowed = useDevelopEntriesNarrowed();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuFileText aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle render={<h3 />}>
          {isNarrowed ? t('No results') : t('decisions.develop.noEntriesTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {isNarrowed
            ? narrowedDescription
            : t('decisions.develop.noEntriesDescription')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Loads the next page when it scrolls into view, and shows `children` (the
 * variant's placeholder rows) while that page loads.
 */
export function DevelopEntriesNextPage({ children }: { children: ReactNode }) {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDevelopEntries();

  const loadNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const { ref, shouldShowTrigger } = useInfiniteScroll<HTMLDivElement>(
    loadNextPage,
    { hasNextPage, isFetchingNextPage },
  );

  return shouldShowTrigger ? (
    <div ref={ref} aria-hidden className="flex flex-col">
      {isFetchingNextPage ? children : null}
    </div>
  ) : null;
}

/** A placeholder for the title cell: one line of text. */
export function DevelopEntryTitleCellSkeleton() {
  return (
    <TableCell className="py-4">
      <Skeleton className="h-4 w-64 max-w-full" />
    </TableCell>
  );
}

/**
 * A placeholder for a cell holding one short line of text. `className`
 * carries the column's width for a skeleton table without a header row.
 */
export function DevelopEntryTextCellSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <TableCell className={cn('py-4', className)}>
      <Skeleton className="h-4 w-20 max-w-full" />
    </TableCell>
  );
}

/** A placeholder for the status cell, at the status badge's height. */
export function DevelopEntryStatusCellSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <TableCell className={cn('py-4', className)}>
      <Skeleton className="h-9 w-24" />
    </TableCell>
  );
}

function useDevelopEntriesContext() {
  const context = useContext(DevelopEntriesContext);
  if (!context) {
    throw new Error('Develop entries parts need a DevelopEntriesProvider');
  }
  return context;
}
