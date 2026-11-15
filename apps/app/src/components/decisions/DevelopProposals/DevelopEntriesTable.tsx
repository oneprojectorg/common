'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { formatCurrency } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import {
  type MoneyAmount,
  type OwnDevelopedProposal,
  nextCursor,
} from '@op/common/client';
import { useDebounce, useInfiniteScroll } from '@op/hooks';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import { useLocale } from 'next-intl';
import { Suspense, useCallback, useDeferredValue, useState } from 'react';
import { LuFileText } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { SearchField } from '@/components/SearchField';

import { ProposalsLoadError } from '../ProposalsLoadError';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The caller's own entries of the current phase, drafts and ready ones: title
 * and origins, and budget, with the title linking into the entry. The search,
 * the order and the pages all come from the API; the heading's count and
 * budget total are the caller's whole set, whatever the search.
 */
export function DevelopEntriesTable({
  processInstanceId,
  entriesTotal,
  budgetTotal,
  editHref,
}: {
  processInstanceId: string;
  /** Every entry of the caller in this phase. */
  entriesTotal: number;
  /** The budget total of every entry, or null when there is none. */
  budgetTotal: MoneyAmount | null;
  /** Where an entry opens. */
  editHref: (entry: OwnDevelopedProposal) => string;
}) {
  const t = useTranslations('decisions.develop');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  // A new search keeps the current rows on screen while the next ones load.
  const search = useDeferredValue(debouncedQuery);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div aria-live="polite">
          <Header3>
            {budgetTotal
              ? t('entriesCountWithBudget', {
                  count: entriesTotal,
                  budget: formatCurrency(
                    budgetTotal.amount,
                    locale,
                    budgetTotal.currency,
                  ),
                })
              : t('entriesCount', { count: entriesTotal })}
          </Header3>
        </div>
        {entriesTotal > 0 ? (
          <SearchField
            value={query}
            onChange={setQuery}
            isPending={search !== query.trim()}
            label={t('searchEntriesLabel')}
          />
        ) : null}
      </div>

      {entriesTotal === 0 ? (
        <EntriesEmpty isSearch={false} />
      ) : (
        <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
          <Suspense fallback={<EntriesSkeleton />}>
            <EntriesPageSuspense
              processInstanceId={processInstanceId}
              search={search}
              editHref={editHref}
            />
          </Suspense>
        </APIErrorBoundary>
      )}
    </div>
  );
}

function EntriesPageSuspense({
  processInstanceId,
  search,
  editHref,
}: {
  processInstanceId: string;
  search: string;
  editHref: (entry: OwnDevelopedProposal) => string;
}) {
  const t = useTranslations('decisions.develop');
  const locale = useLocale();
  const [{ pages }, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.decision.listOwnDevelopedProposals.useSuspenseInfiniteQuery(
      { processInstanceId, search: search || undefined },
      { getNextPageParam: nextCursor },
    );
  const entries = pages.flatMap((page) => page.items);

  const loadNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);
  const { ref: infiniteScrollRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage,
      isFetchingNextPage,
      threshold: 0.1,
      rootMargin: '50px',
    });

  return (
    <div aria-live="polite" className="flex flex-col">
      {entries.length === 0 ? (
        <EntriesEmpty isSearch />
      ) : (
        <Table aria-label={t('entriesTableLabel')}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t('entryColumn')}</TableHead>
              <TableHead scope="col">{t('budgetColumn')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                href={editHref(entry)}
                locale={locale}
              />
            ))}
          </TableBody>
        </Table>
      )}
      {/* `aria-hidden` keeps the trigger out of the a11y tree; the line below
        announces loading instead. */}
      {shouldShowTrigger ? (
        <div ref={infiniteScrollRef} aria-hidden className="py-4">
          {isFetchingNextPage ? <EntriesSkeleton /> : null}
        </div>
      ) : null}
      <span className="sr-only">
        {isFetchingNextPage ? t('loadingMore') : ''}
      </span>
    </div>
  );
}

function EntriesEmpty({ isSearch }: { isSearch: boolean }) {
  const t = useTranslations('decisions.develop');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuFileText className="size-6" />
        </EmptyMedia>
        <EmptyTitle render={<h4 />}>
          {isSearch ? t('noMatchingEntriesTitle') : t('noEntriesTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {isSearch
            ? t('noMatchingEntriesDescription')
            : t('noEntriesDescription')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function EntriesSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
    </div>
  );
}

function EntryRow({
  entry,
  href,
  locale,
}: {
  entry: OwnDevelopedProposal;
  href: string;
  locale: string;
}) {
  const t = useTranslations('decisions.develop');
  const originNames = entry.origins.map((origin) => origin.name).join(', ');

  return (
    <TableRow>
      <TableRowHeader className="py-4">
        <div className="flex flex-col items-start gap-1">
          <Link
            href={href}
            dir="auto"
            className="line-clamp-1 text-base text-foreground ltr:text-left rtl:text-right"
          >
            {entry.title || t('untitledEntry')}
          </Link>
          {originNames ? (
            <span className="text-sm text-muted-foreground">
              {t.rich('entryOrigins', {
                origins: originNames,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </span>
          ) : null}
        </div>
      </TableRowHeader>
      <TableCell className="py-4 tabular-nums">
        {entry.budget && entry.budget.amount > 0
          ? formatCurrency(entry.budget.amount, locale, entry.budget.currency)
          : '—'}
      </TableCell>
    </TableRow>
  );
}
