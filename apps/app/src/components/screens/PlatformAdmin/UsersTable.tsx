'use client';

import type { RouterInput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { Pagination } from '@op/ui/Pagination';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { UsersRow } from './UsersRow';
import styles from './UsersTable.module.css';
import { useCursorPagination } from './useCursorPagination';

const USER_TABLE_MIN_WIDTH = 'min-w-[850px]';

// Infer input type for listAllUsers query
type ListAllUsersInput = RouterInput['platform']['admin']['listAllUsers'];

/** Main users table component with suspense boundary */
export const UsersTable = () => {
  return (
    <Suspense fallback={<UsersTableSkeleton />}>
      <UsersTableContent />
    </Suspense>
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
        styles.usersTableGrid,
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

/** Renders users table with live data */
const UsersTableContent = () => {
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
  };

  const [data] = trpc.platform.admin.listAllUsers.useSuspenseQuery(queryInput);

  const { items: users, next, hasMore, total } = data;

  const onNext = () => {
    if (hasMore && next) {
      handleNext(next);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-md mb-4 font-serif text-neutral-black">
        {t('platformAdmin_allUsers')}
      </h2>
      <div className="overflow-x-auto">
        <div className={USER_TABLE_MIN_WIDTH}>
          <UsersTableHeader />
          <div className="divide-y divide-neutral-gray1">
            {users.map((user) => (
              <UsersRow key={user.id} user={user} />
            ))}
          </div>
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
      </div>
    </div>
  );
};

/** Loading skeleton for users table */
const UsersTableSkeleton = () => {
  const t = useTranslations();

  return (
    <div className="mt-8">
      <h2 className="text-md mb-4 font-serif text-neutral-black">
        {t('platformAdmin_allUsers')}
      </h2>
      <div className="overflow-x-auto">
        <div className={USER_TABLE_MIN_WIDTH}>
          <UsersTableHeader />
          <div className="divide-y divide-neutral-gray1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('py-4', styles.usersTableGrid)}>
                {[...Array(7)].map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
