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
import { LuFileText } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { FilterBarSearch } from '../FilterBar';
import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';
import {
  decisionProposalDevelopHref,
  decisionProposalHref,
} from '../proposalHrefs';

interface DevelopEntriesQuery {
  processInstanceId: string;
  phaseId: string | undefined;
  search: string;
  categoryId: string | undefined;
}

interface DevelopEntriesContextValue {
  state: {
    search: string;
  };
  actions: {
    setSearch: (search: string) => void;
  };
  meta: {
    query: DevelopEntriesQuery;
    isNarrowed: boolean;
  };
}

const DevelopEntriesContext = createContext<DevelopEntriesContextValue | null>(
  null,
);

export function DevelopEntriesProvider({
  processInstanceId,
  phaseId,
  categoryId,
  children,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  categoryId?: string;
  children: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim(), 200);
  // Deferred so the current rows stay on screen while the next ones load.
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

export function useDevelopEntries() {
  const { query } = useDevelopEntriesContext().meta;
  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId: query.processInstanceId,
        phaseId: query.phaseId,
        search: query.search || undefined,
        categoryId: query.categoryId,
        status: ProposalStatus.SUBMITTED,
        limit: PROPOSALS_PAGE_LIMIT,
      },
      { getNextPageParam: nextCursor },
    );

  // The React Compiler is not enabled in this app.
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

export function useDevelopEntriesNarrowed() {
  return useDevelopEntriesContext().meta.isNarrowed;
}

export function DevelopEntriesSearch() {
  const t = useTranslations();
  const { state, actions } = useDevelopEntriesContext();

  return (
    <FilterBarSearch
      value={state.search}
      onChange={actions.setSearch}
      label={t('decisions.develop.searchEntriesLabel')}
    />
  );
}

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

// An entry the caller may edit opens in the develop editor, any other in the
// read-only sheet.
export function DevelopEntryTitleCell({
  entry,
  decisionSlug,
  isEditable,
}: {
  entry: Proposal;
  decisionSlug: string;
  isEditable: boolean;
}) {
  const t = useTranslations();
  const openInSheet = useOpenProposalInSheet();
  const title = entry.profile.name || t('decisions.develop.untitledEntry');

  return (
    <TableRowHeader className="py-4">
      <Link
        href={
          isEditable
            ? decisionProposalDevelopHref({
                decisionSlug,
                profileId: entry.profileId,
              })
            : decisionProposalHref({
                decisionSlug,
                profileId: entry.profileId,
              })
        }
        onClick={isEditable ? undefined : openInSheet(entry.profileId)}
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

/** The state of the entry's category: deliberating until it is confirmed. */
export function DevelopEntryStatusCell({
  isCategoryConfirmed,
}: {
  isCategoryConfirmed: boolean;
}) {
  const t = useTranslations();

  return (
    <TableCell className="py-4">
      {isCategoryConfirmed ? (
        <StatusBadge variant="success" icon={false}>
          {t('decisions.develop.entryConfirmedStatus')}
        </StatusBadge>
      ) : (
        <StatusBadge variant="in-progress" icon={false}>
          {t('decisions.develop.entryDeliberatingStatus')}
        </StatusBadge>
      )}
    </TableCell>
  );
}

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

export function DevelopEntryTitleCellSkeleton() {
  return (
    <TableCell className="py-4">
      <Skeleton className="h-4 w-64 max-w-full" />
    </TableCell>
  );
}

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
