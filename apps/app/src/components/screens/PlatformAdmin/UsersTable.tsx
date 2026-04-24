'use client';

import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { Header2 } from '@op/ui/Header';
import { Menu, MenuItem } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Pagination } from '@op/ui/Pagination';
import { SearchField } from '@op/ui/SearchField';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/table';
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LuDownload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UsersRowCells } from './UsersRow';

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
        toast.success({ message: t('Users exported successfully') });
      } catch (error) {
        console.error('Export failed:', error);
        toast.error({ message: t('Failed to export users') });
      }
    });
  }, [utils, t]);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-md font-serif">
          {t('platformAdmin_allUsers')}
        </Header2>
        <div className="flex items-center gap-2">
          <div className="w-64">
            <SearchField
              aria-label={t('Search users by name or email')}
              placeholder={t('Search users by name or email')}
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
                {t('Export all users')}
              </MenuItem>
            </Menu>
          </OptionMenu>
        </div>
      </div>
      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersTableContent searchQuery={debouncedQuery} />
      </Suspense>
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

  const [data] = trpc.platform.admin.listAllUsers.useSuspenseQuery(queryInput);

  const { items: users, next, total } = data;

  const onNext = () => {
    if (next) {
      handleNext(next);
    }
  };

  return (
    <>
      <Table
        aria-label={t('platformAdmin_allUsers')}
        key={users.map((u) => u.id).join(',')}
      >
        <TableHeader>
          <TableColumn isRowHeader>{t('Name')}</TableColumn>
          <TableColumn>{t('Email')}</TableColumn>
          <TableColumn>{t('Role')}</TableColumn>
          <TableColumn>{t('Organization')}</TableColumn>
          <TableColumn>{t('Created')}</TableColumn>
          <TableColumn>{t('Last sign in')}</TableColumn>
          <TableColumn className="text-right">{t('Actions')}</TableColumn>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} id={user.id}>
              <UsersRowCells user={user} />
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
            label: t('users'),
          }}
          next={next ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

/** Loading skeleton */
const UsersTableSkeleton = () => {
  return (
    <Table aria-label="Loading users">
      <TableHeader>
        <TableColumn isRowHeader>
          <Skeleton className="h-4 w-16" />
        </TableColumn>
        <TableColumn>
          <Skeleton className="h-4 w-16" />
        </TableColumn>
        <TableColumn>
          <Skeleton className="h-4 w-12" />
        </TableColumn>
        <TableColumn>
          <Skeleton className="h-4 w-20" />
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
            {[...Array(7)].map((_, j) => (
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
