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

import { OrgsRowCells } from './OrgsRow';

/** Main organizations table component with suspense boundary */
export const OrgsTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-md font-serif">
          {t('All Organizations')}
        </Header2>
        <div className="w-64">
          <SearchField
            aria-label={t('Search organizations by name')}
            placeholder={t('Search organizations by name')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
      </div>
      <Suspense fallback={<OrgsTableSkeleton />}>
        <OrgsTableContent searchQuery={debouncedQuery} />
      </Suspense>
    </div>
  );
};

/** Renders organizations table with live data */
const OrgsTableContent = ({ searchQuery }: { searchQuery: string }) => {
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

  // Reset pagination when search query changes
  useEffect(() => {
    reset();
  }, [searchQuery]);

  const queryInput = {
    cursor,
    limit,
    query: searchQuery || undefined,
  };

  const [data] =
    trpc.platform.admin.listAllOrganizations.useSuspenseQuery(queryInput);

  const { items: orgs, next, total } = data;

  const onNext = () => {
    if (next) {
      handleNext(next);
    }
  };

  return (
    <>
      <Table aria-label={t('All Organizations')}>
        <TableHeader>
          <TableColumn isRowHeader>{t('Name')}</TableColumn>
          <TableColumn>{t('Domain')}</TableColumn>
          <TableColumn>{t('Members')}</TableColumn>
          <TableColumn>{t('Created')}</TableColumn>
          <TableColumn className="text-right">{t('Actions')}</TableColumn>
        </TableHeader>
        <TableBody items={orgs} dependencies={[searchQuery]}>
          {(org) => (
            <TableRow id={org.id}>
              <OrgsRowCells org={org} />
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="mt-4">
        <Pagination
          range={{
            totalItems: total,
            itemsPerPage: limit,
            page: currentPage,
            label: t('organizations'),
          }}
          next={next ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

/** Loading skeleton */
const OrgsTableSkeleton = () => {
  return (
    <Table aria-label="Loading organizations">
      <TableHeader>
        <TableColumn isRowHeader>
          <Skeleton className="h-4 w-16" />
        </TableColumn>
        <TableColumn>
          <Skeleton className="h-4 w-16" />
        </TableColumn>
        <TableColumn>
          <Skeleton className="h-4 w-14" />
        </TableColumn>
        <TableColumn>
          <Skeleton className="h-4 w-14" />
        </TableColumn>
        <TableColumn>
          <Skeleton className="h-4 w-14" />
        </TableColumn>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i} id={`skeleton-${i}`}>
            {[...Array(5)].map((_, j) => (
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
