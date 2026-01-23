'use client';

import type { RouterInput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { Pagination } from '@op/ui/Pagination';
import { SearchField } from '@op/ui/SearchField';
import { useEffect, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { ProfileUsersAccessTable } from './ProfileUsersAccessTable';

type ListUsersInput = RouterInput['profile']['listUsers'];
type SortColumn = NonNullable<ListUsersInput['orderBy']>;
type SortDirection = NonNullable<ListUsersInput['dir']>;

const ITEMS_PER_PAGE = 25;

export const ProfileUsersAccessPage = ({
  profileId,
}: {
  profileId: string;
}) => {
  const t = useTranslations();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset is intentionally excluded to avoid infinite loop
  useEffect(() => {
    reset();
  }, [debouncedQuery, sortDescriptor.column, sortDescriptor.direction]);

  // Convert React Aria sort descriptor to API format
  const orderBy = sortDescriptor.column as SortColumn;
  const dir: SortDirection =
    sortDescriptor.direction === 'ascending' ? 'asc' : 'desc';

  // Build query input - only include query if >= 2 chars (API requirement)
  const queryInput: ListUsersInput = {
    profileId,
    cursor,
    limit: ITEMS_PER_PAGE,
    orderBy,
    dir,
    query: debouncedQuery.length >= 2 ? debouncedQuery : undefined,
  };

  // Use regular query - cache handles exact query matches, loading shown for uncached queries
  const { data, isPending, isError, refetch } =
    trpc.profile.listUsers.useQuery(queryInput);

  const profileUsers = data?.items ?? [];
  const next = data?.next;
  const hasMore = data?.hasMore ?? false;

  const onNext = () => {
    if (hasMore && next) {
      handleNext(next);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-title-sm font-light text-neutral-black">
        {t('Members')}
      </h2>

      <SearchField
        placeholder={t('Search')}
        value={searchQuery}
        onChange={setSearchQuery}
        className="w-full max-w-96"
      />

      <ProfileUsersAccessTable
        profileUsers={profileUsers}
        profileId={profileId}
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
        isLoading={isPending}
        isError={isError}
        onRetry={() => void refetch()}
      />

      <Pagination
        next={hasMore ? onNext : undefined}
        previous={canGoPrevious ? handlePrevious : undefined}
      />
    </div>
  );
};
