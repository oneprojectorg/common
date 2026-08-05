'use client';

import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { Header2 } from '@op/sense/Header';
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

import { OrgsRowCells } from './OrgsRow';
import { TablePagination } from './TablePagination';
import { TableSearchField } from './TableSearchField';

/** Main organizations table component with suspense boundary */
export const OrgsTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-title">{t('All Organizations')}</Header2>
        <TableSearchField
          className="w-64"
          aria-label={t('Search organizations by name')}
          placeholder={t('Search organizations by name')}
          value={searchQuery}
          onChange={setSearchQuery}
        />
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
          <TableRow>
            <TableHead>{t('Name')}</TableHead>
            <TableHead>{t('Domain')}</TableHead>
            <TableHead>{t('Members')}</TableHead>
            <TableHead>{t('Created')}</TableHead>
            <TableHead className="text-end">{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => (
            <TableRow key={org.id}>
              <OrgsRowCells org={org} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4">
        <TablePagination
          totalItems={total}
          itemsPerPage={limit}
          page={currentPage}
          label={t('organizations')}
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
        <TableRow>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-14" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-14" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-14" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
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
