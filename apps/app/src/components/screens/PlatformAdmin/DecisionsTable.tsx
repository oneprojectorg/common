'use client';

import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { Header2 } from '@op/sense/Header';
import { PaginationBar } from '@op/sense/PaginationBar';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { Suspense, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DecisionsRowCells } from './DecisionsRow';
import { TableSearchField } from './TableSearchField';

/** Main decisions table component with suspense boundary */
export const DecisionsTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-title">{t('All Decisions')}</Header2>
        <TableSearchField
          className="w-64"
          aria-label={t('Search decisions by name')}
          placeholder={t('Search decisions by name')}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>
      <Suspense fallback={<DecisionsTableSkeleton />}>
        <DecisionsTableContent searchQuery={debouncedQuery} />
      </Suspense>
    </div>
  );
};

/** Renders decisions table with live data */
const DecisionsTableContent = ({ searchQuery }: { searchQuery: string }) => {
  const t = useTranslations();
  const {
    cursor,
    currentPage,
    limit,
    handleNext,
    handlePrevious,
    canGoPrevious,
    reset,
  } = useCursorPagination(5);

  useEffect(() => {
    reset();
  }, [searchQuery]);

  const queryInput = {
    cursor,
    limit,
    query: searchQuery || undefined,
  };

  const [data] =
    trpc.platform.admin.listAllDecisionInstances.useSuspenseQuery(queryInput);

  const { items: decisions, next, total } = data;

  const onNext = () => {
    if (next) {
      handleNext(next);
    }
  };

  return (
    <>
      <Table aria-label={t('All Decisions')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Name')}</TableHead>
            <TableHead>{t('Current Phase')}</TableHead>
            <TableHead>{t('Steward')}</TableHead>
            <TableHead>{t('Proposals')}</TableHead>
            <TableHead>{t('Participants')}</TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead>{t('Created')}</TableHead>
            <TableHead className="text-end">{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {decisions.map((decision) => (
            <TableRow key={decision.id}>
              <DecisionsRowCells decision={decision} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4">
        <PaginationBar
          range={{ totalItems: total, itemsPerPage: limit, page: currentPage }}
          renderRange={({ start, end, total: count }) =>
            t('{start} - {end} of {total} {label}', {
              start,
              end,
              total: count,
              label: t('decisions'),
            })
          }
          previousLabel={t('Previous')}
          nextLabel={t('Next')}
          navLabel={t('Pagination Navigation')}
          next={next ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

/** Loading skeleton - real header labels with skeleton rows */
const DecisionsTableSkeleton = () => {
  const t = useTranslations();

  return (
    <Table aria-label="Loading decisions">
      <TableHeader>
        <TableRow>
          <TableHead>{t('Name')}</TableHead>
          <TableHead>{t('Current Phase')}</TableHead>
          <TableHead>{t('Steward')}</TableHead>
          <TableHead>{t('Proposals')}</TableHead>
          <TableHead>{t('Participants')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead>{t('Created')}</TableHead>
          <TableHead className="text-end">{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i} className="h-[61px]">
            {[...Array(8)].map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
