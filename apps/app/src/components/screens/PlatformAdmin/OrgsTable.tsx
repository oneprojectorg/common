'use client';

import type { RouterInput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { Pagination } from '@op/ui/Pagination';
import { SearchField } from '@op/ui/SearchField';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { Suspense, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { OrgsRow } from './OrgsRow';

const ORGS_TABLE_MIN_WIDTH = 'min-w-[750px]';
const ORGS_TABLE_GRID =
  'grid grid-cols-[minmax(200px,2fr)_minmax(100px,1fr)_minmax(150px,1.5fr)_minmax(100px,0.8fr)_minmax(120px,1fr)] gap-4';

type ListAllOrgsInput = RouterInput['platform']['admin']['listAllOrganizations'];

/** Main organizations table component with suspense boundary */
export const OrgsTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-md font-serif text-neutral-black">
          {t('All Organizations')}
        </h2>
        <div className="w-64">
          <SearchField
            aria-label={t('Search organizations by name')}
            placeholder={t('Search organizations by name')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className={ORGS_TABLE_MIN_WIDTH}>
          <OrgsTableHeader />
          <Suspense fallback={<OrgsTableContentSkeleton />}>
            <OrgsTableContent searchQuery={debouncedQuery} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

/** Table header component */
const OrgsTableHeader = () => {
  const t = useTranslations();

  const columnHeadings = [
    t('Name'),
    t('Type'),
    t('Domain'),
    t('Network'),
    t('platformAdmin_columnCreated'),
  ];

  return (
    <div className={cn('bg-neutral-gray0 border-b py-3', ORGS_TABLE_GRID)}>
      {columnHeadings.map((heading) => (
        <div key={heading} className="text-sm font-normal text-neutral-charcoal">
          {heading}
        </div>
      ))}
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
  } = useCursorPagination(10);

  // Reset pagination when search query changes
  useEffect(() => {
    reset();
  }, [searchQuery]);

  const queryInput: ListAllOrgsInput = {
    cursor,
    limit,
    query: searchQuery || undefined,
  };

  const [data] = trpc.platform.admin.listAllOrganizations.useSuspenseQuery(queryInput);

  const { items: orgs, next, hasMore, total } = data;

  const onNext = () => {
    if (hasMore && next) {
      handleNext(next);
    }
  };

  return (
    <>
      <div className="divide-y divide-neutral-gray1">
        {orgs.map((org) => (
          <OrgsRow key={org.id} org={org} />
        ))}
      </div>
      <div className="mt-4">
        <Pagination
          range={{
            totalItems: total,
            itemsPerPage: limit,
            page: currentPage,
            label: t('organizations'),
          }}
          next={hasMore ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

/** Loading skeleton for table content only */
const OrgsTableContentSkeleton = () => {
  return (
    <div className="divide-y divide-neutral-gray1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={cn('py-4', ORGS_TABLE_GRID)}>
          {[...Array(5)].map((_, j) => (
            <Skeleton key={j} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
};
