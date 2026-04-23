'use client';

import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { Header2 } from '@op/ui/Header';
import { Pagination } from '@op/ui/Pagination';
import { SearchField } from '@op/ui/SearchField';
import { Skeleton } from '@op/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/table';
import { Suspense, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DecisionsRowCells } from './DecisionsRow';

/** Main decisions table component with suspense boundary */
export const DecisionsTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-md font-serif">{t('All Decisions')}</Header2>
        <div className="w-64">
          <SearchField
            aria-label={t('Search decisions by name')}
            placeholder={t('Search decisions by name')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
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

  const { items: decisions, next, hasMore, total } = data;

  const onNext = () => {
    if (hasMore && next) {
      handleNext(next);
    }
  };

  return (
    <>
      <Table
        aria-label={t('All Decisions')}
        key={decisions.map((d) => d.id).join(',')}
      >
        <TableHeader>
          <TableColumn isRowHeader>{t('Name')}</TableColumn>
          <TableColumn>{t('Current Phase')}</TableColumn>
          <TableColumn>{t('Steward')}</TableColumn>
          <TableColumn>{t('Proposals')}</TableColumn>
          <TableColumn>{t('Participants')}</TableColumn>
          <TableColumn>{t('Status')}</TableColumn>
          <TableColumn>{t('Created')}</TableColumn>
          <TableColumn className="text-right">{t('Actions')}</TableColumn>
        </TableHeader>
        <TableBody>
          {decisions.map((decision) => (
            <TableRow key={decision.id} id={decision.id}>
              <DecisionsRowCells decision={decision} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4">
        <Pagination
          range={{
            totalItems: total,
            itemsPerPage: limit,
            page: currentPage,
            label: t('decisions'),
          }}
          next={hasMore ? onNext : undefined}
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
        <TableColumn isRowHeader>{t('Name')}</TableColumn>
        <TableColumn>{t('Current Phase')}</TableColumn>
        <TableColumn>{t('Steward')}</TableColumn>
        <TableColumn>{t('Proposals')}</TableColumn>
        <TableColumn>{t('Participants')}</TableColumn>
        <TableColumn>{t('Status')}</TableColumn>
        <TableColumn>{t('Created')}</TableColumn>
        <TableColumn className="text-right">{t('Actions')}</TableColumn>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i} id={`skeleton-${i}`}>
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
