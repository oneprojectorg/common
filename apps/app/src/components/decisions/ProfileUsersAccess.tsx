'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { trpc } from '@op/api/client';
import type { SortDir } from '@op/common';
import { useCursorPagination, useDebounce, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Pagination } from '@op/ui/Pagination';
import { SearchField } from '@op/ui/SearchField';
import { Skeleton } from '@op/ui/Skeleton';
import { useEffect, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { ProfileUsersAccessTable } from './ProfileUsersAccessTable';

// Sort columns supported by profile.listUsers endpoint
type SortColumn = 'name' | 'email' | 'role';

const ITEMS_PER_PAGE = 25;

export const ProfileUsersAccess = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  // Sorting state
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'name',
    direction: 'ascending',
  });

  // Cursor pagination
  const { cursor, handleNext, handlePrevious, canGoPrevious, reset } =
    useCursorPagination(ITEMS_PER_PAGE);

  // Reset pagination when search or sort changes
  useEffect(() => {
    reset();
  }, [debouncedQuery, sortDescriptor.column, sortDescriptor.direction, reset]);

  // Convert React Aria sort descriptor to API format
  const orderBy = sortDescriptor.column as SortColumn;
  const dir: SortDir =
    sortDescriptor.direction === 'ascending' ? 'asc' : 'desc';

  // Build query input - only include query if >= 2 chars
  const queryInput = {
    profileId,
    cursor,
    limit: ITEMS_PER_PAGE,
    orderBy,
    dir,
    query: debouncedQuery.length >= 2 ? debouncedQuery : undefined,
  };

  // Use regular query - cache handles exact query matches, loading shown for uncached queries. We don't use a Suspense due to not wanting to suspend the entire table
  const { data, isPending, isError, refetch } =
    trpc.profile.listUsers.useQuery(queryInput);

  // Fetch roles in parallel to avoid waterfall loading
  const { data: rolesData, isPending: rolesPending } =
    trpc.organization.getRoles.useQuery();

  const { items: profileUsers = [], next } = data ?? {};
  const { roles = [] } = rolesData ?? {};

  const onNext = () => {
    if (next) {
      handleNext(next);
    }
  };

  return (
    <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-title-sm font-light text-neutral-black">
          {t('Members')}
        </h2>

        <SearchField
          placeholder={t('Search')}
          value={searchQuery}
          onChange={setSearchQuery}
          size={isMobile ? 'small' : undefined}
          className="w-full sm:max-w-96"
        />

        <ProfileUsersAccessTable
          profileUsers={profileUsers}
          profileId={profileId}
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
          isLoading={isPending || rolesPending}
          isError={isError}
          onRetry={() => void refetch()}
          roles={roles}
          isMobile={isMobile}
        />

        <Pagination
          next={next ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </ClientOnly>
  );
};
