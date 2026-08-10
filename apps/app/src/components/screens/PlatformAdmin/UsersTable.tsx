'use client';

import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Header2 } from '@op/sense/Header';
import { PaginationBar } from '@op/sense/PaginationBar';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { toast } from '@op/sense/Toast';
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LuDownload, LuEllipsis } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { TableSearchField } from './TableSearchField';
import { UsersRowCells } from './UsersRow';

/** Anonymous-account filter options for the users list */
type AnonFilter = 'exclude' | 'include';

/** Users rendered per page — also drives the loading skeleton's row count */
const USERS_PER_PAGE = 50;

/**
 * Exports user data to CSV and triggers download
 */
const exportUsersToCSV = (
  users: Array<{ name: string | null; email: string | null }>,
) => {
  const header = 'name,email\n';
  const rows = users
    .map((user) => {
      const name = user.name?.replace(/"/g, '""') ?? '';
      const email = user.email?.replace(/"/g, '""') ?? '';
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
  const [anonFilter, setAnonFilter] = useState<AnonFilter>('exclude');
  const includeAnonymous = anonFilter === 'include';
  const [isExporting, startExportTransition] = useTransition();

  const anonFilterItems: Array<{ value: AnonFilter; label: string }> = [
    { value: 'exclude', label: t('Exclude anonymous users') },
    { value: 'include', label: t('Include anonymous users') },
  ];

  const handleExportAllUsers = useCallback(() => {
    startExportTransition(async () => {
      try {
        // Fetch all users without limit, honouring the anonymous filter
        const result = await utils.platform.admin.listAllUsers.fetch({
          includeAnonymous,
        });

        if (result.items.length === 0) {
          return;
        }

        const allUsers = result.items.map((user) => ({
          name: user.profile?.name ?? user.name,
          email: user.email,
        }));

        exportUsersToCSV(allUsers);
        toast.success(t('Users exported successfully'));
      } catch (error) {
        logger.error('Export failed', { error, context: 'UsersTable.export' });
        toast.error(t('Failed to export users'));
      }
    });
  }, [utils, t, includeAnonymous]);

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Header2 className="text-title">{t('platformAdmin_allUsers')}</Header2>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchField
            className="w-full sm:w-64"
            aria-label={t('Search users by name or email')}
            placeholder={t('Search users by name or email')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <Select
            items={anonFilterItems}
            value={anonFilter}
            onValueChange={(value) => {
              if (value) {
                setAnonFilter(value);
              }
            }}
          >
            <SelectTrigger
              aria-label={t('Filter anonymous users')}
              className="min-w-36 flex-1 sm:w-36 sm:flex-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {anonFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('User options')}
                  className="me-1"
                >
                  <LuEllipsis />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleExportAllUsers}
                disabled={isExporting}
              >
                <LuDownload className="size-4" />
                {t('Export all users')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersTableContent
          searchQuery={debouncedQuery}
          includeAnonymous={includeAnonymous}
        />
      </Suspense>
    </div>
  );
};

/** Renders users table with live data */
const UsersTableContent = ({
  searchQuery,
  includeAnonymous,
}: {
  searchQuery: string;
  includeAnonymous: boolean;
}) => {
  const t = useTranslations();
  const {
    cursor,
    currentPage,
    limit,
    handleNext,
    handlePrevious,
    canGoPrevious,
    reset,
  } = useCursorPagination(USERS_PER_PAGE);

  // Reset pagination when the search query or anonymous filter changes
  useEffect(() => {
    reset();
  }, [searchQuery, includeAnonymous]);

  const queryInput = {
    cursor,
    limit,
    query: searchQuery || undefined,
    includeAnonymous,
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
      <Table aria-label={t('platformAdmin_allUsers')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Name')}</TableHead>
            <TableHead>{t('Email')}</TableHead>
            <TableHead>{t('Role')}</TableHead>
            <TableHead>{t('Organization')}</TableHead>
            <TableHead>{t('Created')}</TableHead>
            <TableHead>{t('Last sign in')}</TableHead>
            <TableHead className="text-end">{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <UsersRowCells user={user} />
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
              label: t('users'),
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

/** Loading skeleton */
const UsersTableSkeleton = () => {
  return (
    <Table aria-label="Loading users">
      <TableHeader>
        <TableRow>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-12" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-20" />
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
        {[...Array(USERS_PER_PAGE)].map((_, i) => (
          <TableRow key={i} className="h-[61px]">
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
