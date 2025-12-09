'use client';

import type { RouterInput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { Menu, MenuItem } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Pagination } from '@op/ui/Pagination';
import { SearchField } from '@op/ui/SearchField';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LuDownload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UsersRow } from './UsersRow';

const USER_TABLE_MIN_WIDTH = 'min-w-[850px]';
const USERS_TABLE_GRID =
  'grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.5fr)_minmax(100px,0.8fr)_minmax(200px,2.2fr)_minmax(80px,0.5fr)_minmax(80px,0.5fr)_80px] gap-4';

// Infer input type for listAllUsers query
type ListAllUsersInput = RouterInput['platform']['admin']['listAllUsers'];

/**
 * Exports user data to CSV and triggers download
 */
const exportUsersToCSV = (
  users: Array<{ name: string | null; email: string }>,
) => {
  const header = 'name,email\n';
  const rows = users
    .map((user) => {
      const name = user.name?.replace(/"/g, '""') ?? '';
      const email = user.email.replace(/"/g, '""');
      return `"${name}","${email}"`;
    })
    .join('\n');

  const csvContent = header + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Main users table component with suspense boundary */
export const UsersTable = () => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);
  const [isExporting, startExportTransition] = useTransition();

  const handleExportAllUsers = useCallback(() => {
    startExportTransition(async () => {
      try {
        // Fetch all users without limit
        const result = await utils.platform.admin.listAllUsers.fetch({});

        if (result.items.length === 0) {
          return;
        }

        const allUsers = result.items.map((user) => ({
          name: user.profile?.name ?? user.name,
          email: user.email,
        }));

        exportUsersToCSV(allUsers);
        toast.success({ message: t('platformAdmin_exportSuccess') });
      } catch (error) {
        console.error('Export failed:', error);
        toast.error({ message: t('platformAdmin_exportError') });
      }
    });
  }, [utils, t]);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-md font-serif text-neutral-black">
          {t('platformAdmin_allUsers')}
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-64">
            <SearchField
              aria-label={t('platformAdmin_searchUsersPlaceholder')}
              placeholder={t('platformAdmin_searchUsersPlaceholder')}
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <OptionMenu variant="outline" size="medium" className="mr-1">
            <Menu>
              <MenuItem
                onAction={handleExportAllUsers}
                isDisabled={isExporting}
              >
                <LuDownload className="size-4" />
                {t('platformAdmin_exportAllUsers')}
              </MenuItem>
            </Menu>
          </OptionMenu>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className={USER_TABLE_MIN_WIDTH}>
          <UsersTableHeader />
          <Suspense fallback={<UsersTableContentSkeleton />}>
            <UsersTableContent searchQuery={debouncedQuery} />
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
    reset,
  } = useCursorPagination(10);

  // Reset pagination when search query changes
  useEffect(() => {
    reset();
  }, [searchQuery]);

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
