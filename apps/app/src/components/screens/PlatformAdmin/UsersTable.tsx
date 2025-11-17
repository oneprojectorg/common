'use client';

import type { RouterInput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { Pagination } from '@op/ui/Pagination';
import { SearchField } from '@op/ui/SearchField';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { Suspense, useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

import { UsersRow } from './UsersRow';
import { useCursorPagination } from './useCursorPagination';

const USER_TABLE_MIN_WIDTH = 'min-w-[850px]';
const USERS_TABLE_GRID =
  'grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.5fr)_minmax(100px,0.8fr)_minmax(200px,2.2fr)_minmax(80px,0.5fr)_minmax(80px,0.5fr)_80px] gap-4';

// Infer input type for listAllUsers query
type ListAllUsersInput = RouterInput['platform']['admin']['listAllUsers'];

/** Main users table component with suspense boundary */
export const UsersTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSearchChange = (value: string) => {
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-md font-serif text-neutral-black">
          {t('platformAdmin_allUsers')}
        </h2>
        <div className="w-64">
          <SearchField
            aria-label="Search users by email"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className={cn(USER_TABLE_MIN_WIDTH, isPending && 'opacity-50')}>
          <UsersTableHeader />
          <Suspense key={searchQuery} fallback={<UsersTableContentSkeleton />}>
            <UsersTableContentWrapper searchQuery={searchQuery} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

/** Table header component */
const UsersTableHeader = () => {
  const t = useTranslations();

  const columnHeadings = [
    t('platformAdmin_columnName'),
    t('platformAdmin_columnEmail'),
    t('platformAdmin_columnRole'),
    t('platformAdmin_columnOrganization'),
    t('platformAdmin_columnLastUpdated'),
    t('platformAdmin_columnLastSignIn'),
    t('platformAdmin_columnActions'),
  ];

  return (
    <div
      className={cn(
        'bg-neutral-gray0 border-b border-neutral-gray1 py-3',
        USERS_TABLE_GRID,
      )}
    >
      {columnHeadings.map((heading, idx) => (
        <div
          key={heading}
          className={cn(
            'text-sm font-normal text-neutral-charcoal',
            idx === columnHeadings.length - 1 && 'text-right',
          )}
        >
          {heading}
        </div>
      ))}
    </div>
  );
};

/** Wrapper to pass props to suspense content */
const UsersTableContentWrapper = ({ searchQuery }: { searchQuery: string }) => {
  return <UsersTableContent searchQuery={searchQuery} />;
};

/** Renders users table with live data */
const UsersTableContent = ({ searchQuery }: { searchQuery: string }) => {
  const t = useTranslations();
  const {
    cursor,
    currentPage,
    limit,
    handleNext,
    handlePrevious,
    canGoPrevious,
  } = useCursorPagination(10);

  const queryInput: ListAllUsersInput = {
    cursor,
    limit,
    query: searchQuery || undefined,
  };

  const [data] = trpc.platform.admin.listAllUsers.useSuspenseQuery(queryInput);

  const { items: users, next, hasMore, total } = data;

  const onNext = () => {
    if (hasMore && next) {
      handleNext(next);
    }
  };

  return (
    <>
      <div className="divide-y divide-neutral-gray1">
        {users.map((user) => (
          <UsersRow key={user.id} user={user} />
        ))}
      </div>
      <div className="mt-4">
        <Pagination
          range={{
            totalItems: total,
            itemsPerPage: limit,
            page: currentPage,
            label: t('platformAdmin_paginationUsers'),
          }}
          next={hasMore ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

/** Loading skeleton for table content only */
const UsersTableContentSkeleton = () => {
  return (
    <div className="divide-y divide-neutral-gray1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={cn('py-4', USERS_TABLE_GRID)}>
          {[...Array(7)].map((_, j) => (
            <Skeleton key={j} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
};
