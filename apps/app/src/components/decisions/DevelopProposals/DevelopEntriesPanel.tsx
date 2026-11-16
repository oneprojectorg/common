'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import { nextCursor } from '@op/common/client';
import { useDebounce, useInfiniteScroll } from '@op/hooks';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header2 } from '@op/sense/Header';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from 'react';
import { LuFileText, LuSearch } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';
import {
  type ProposalRoute,
  proposalEditHref,
  proposalHref,
} from '../proposalHrefs';

type Route = Omit<ProposalRoute, 'profileId'>;

/**
 * The Entries tab of the develop screen: the entries this phase holds, with
 * their budget and whether they are still in progress or advancing. The
 * search runs in the API, page by page, like the list itself.
 */
export function DevelopEntriesPanel({
  processInstanceId,
  phaseId,
  totalEntries,
  route,
}: {
  processInstanceId: string;
  /** The develop phase, whose entries are listed. */
  phaseId: string | undefined;
  /** Every entry of the phase, whatever the search. */
  totalEntries: number;
  route: Route;
}) {
  const t = useTranslations('decisions.develop');
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim(), 200);
  // Keeps the current rows on screen while the next search loads, instead of
  // swapping the table for its skeleton on every keystroke.
  const deferredSearch = useDeferredValue(debouncedSearch);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <Header2 className="text-title font-normal">
          {t('entriesCount', { count: totalEntries })}
        </Header2>
        <InputGroup className="w-full sm:w-56">
          <InputGroupAddon align="inline-start">
            <LuSearch aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchEntriesPlaceholder')}
            aria-label={t('searchEntriesLabel')}
          />
        </InputGroup>
      </div>

      <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
        <Suspense fallback={<DevelopEntriesTableSkeleton />}>
          <DevelopEntriesTable
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            search={deferredSearch}
            route={route}
          />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function DevelopEntriesTable({
  processInstanceId,
  phaseId,
  search,
  route,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  search: string;
  route: Route;
}) {
  const t = useTranslations('decisions');
  const openInSheet = useOpenProposalInSheet();

  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId,
        phaseId,
        search: search || undefined,
        limit: PROPOSALS_PAGE_LIMIT,
      },
      { getNextPageParam: nextCursor },
    );

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

  if (entries.length === 0) {
    return (
      <div aria-live="polite">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuFileText aria-hidden className="size-5" />
            </EmptyMedia>
            <EmptyTitle render={<h3 />}>
              {search
                ? t('develop.noMatchingEntriesTitle')
                : t('develop.noEntriesTitle')}
            </EmptyTitle>
            <EmptyDescription>
              {search
                ? t('develop.noMatchingEntriesDescription')
                : t('develop.noEntriesDescription')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Table
        aria-label={t('develop.entriesTableLabel')}
        className="min-w-3xl table-fixed [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
      >
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t('develop.entryColumn')}</TableHead>
            <TableHead scope="col" className="w-30">
              {t('budgetLabel')}
            </TableHead>
            <TableHead scope="col" className="w-45">
              {t('develop.statusColumn')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const title = entry.profile.name || t('develop.untitledEntry');
            const budget = entry.proposalData.budget;
            const isDraft = entry.status === ProposalStatus.DRAFT;

            return (
              <TableRow key={entry.id}>
                <TableRowHeader className="py-4">
                  {/* An entry its caller may still edit opens in the editor;
                      any other opens read-only. */}
                  <Link
                    href={
                      entry.isEditable
                        ? proposalEditHref({
                            ...route,
                            profileId: entry.profileId,
                          })
                        : proposalHref({ ...route, profileId: entry.profileId })
                    }
                    onClick={
                      entry.isEditable
                        ? undefined
                        : openInSheet(entry.profileId)
                    }
                    dir="auto"
                    className="block truncate text-base font-strong text-foreground hover:underline ltr:text-left rtl:text-right"
                  >
                    {title}
                  </Link>
                </TableRowHeader>
                <TableCell className="py-4 tabular-nums">
                  {budget ? (
                    formatCurrency(budget.amount, undefined, budget.currency)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-4">
                  <StatusBadge
                    variant={isDraft ? 'in-progress' : 'success'}
                    icon={false}
                  >
                    {isDraft
                      ? t('develop.entryInProgressStatus')
                      : t('develop.entryAdvancingStatus')}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {shouldShowTrigger ? (
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
      ) : null}
    </div>
  );
}

function DevelopEntriesTableSkeleton() {
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
