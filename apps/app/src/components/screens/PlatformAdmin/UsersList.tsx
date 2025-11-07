'use client';

import type { RouterInput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { Pagination } from '@op/ui/Pagination';
import { cn } from '@op/ui/utils';
import { Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { UserRow } from './UserRow';

// Infer input type for listAllUsers query
type ListAllUsersInput = RouterInput['platform']['admin']['listAllUsers'];

/** Main users list component with suspense boundary */
export const UsersList = () => {
  return (
    <Suspense fallback={<UsersListSkeleton />}>
      <UsersListContent />
    </Suspense>
  );
};

/** Renders users list with live data */
const UsersListContent = () => {
  const t = useTranslations();
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const limit = 10;

  const queryInput: ListAllUsersInput = {
    cursor,
    limit,
  };

  const [data] = trpc.platform.admin.listAllUsers.useSuspenseQuery(queryInput);

  const { items: users, next, hasMore, total } = data;
  const currentPage = cursorHistory.length - 1;

  const handleNext = () => {
    if (hasMore && next) {
      setCursorHistory([...cursorHistory, next]);
      setCursor(next);
    }
  };

  const handlePrevious = () => {
    if (cursorHistory.length > 1) {
      const newHistory = [...cursorHistory];
      newHistory.pop();
      setCursorHistory(newHistory);
      setCursor(newHistory[newHistory.length - 1] ?? null);
    }
  };

  const columnHeadings = [
    t('Name'),
    t('Email'),
    t('Role'),
    t('Organization'),
    t('Joined'),
    t('Actions'),
  ];

  return (
    <div className="mt-8">
      <h2 className="text-md mb-4 font-serif text-neutral-black">
        {t('All Users')}
      </h2>
      <div className="overflow-hidden">
        <div className="bg-neutral-gray0 grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.5fr)_minmax(100px,0.8fr)_minmax(200px,2.2fr)_minmax(80px,0.5fr)_80px] gap-4 border-b border-neutral-gray1 py-3">
          {columnHeadings.map((heading, idx) => (
            <div
              key={heading}
              className={cn(
                'justify-end text-sm font-medium text-neutral-charcoal',
                idx === columnHeadings.length - 1 && 'text-right',
              )}
            >
              {heading}
            </div>
          ))}
        </div>
        <div className="divide-y divide-neutral-gray1">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
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
            next={hasMore ? handleNext : undefined}
            previous={cursorHistory.length > 1 ? handlePrevious : undefined}
          />
        </div>
      </div>
    </div>
  );
};

/** Loading skeleton for users list */
const UsersListSkeleton = () => {
  return (
    <div className="mt-8">
      <div className="mb-4 h-8 w-48 animate-pulse rounded bg-neutral-gray1" />
      <div className="overflow-hidden">
        <div className="bg-neutral-gray0 grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.5fr)_minmax(100px,0.8fr)_minmax(200px,2.2fr)_minmax(80px,0.5fr)_80px] gap-4 border-b border-neutral-gray1 py-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-4 w-20 animate-pulse rounded bg-neutral-gray1"
            />
          ))}
        </div>
        <div className="divide-y divide-neutral-gray1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.5fr)_minmax(100px,0.8fr)_minmax(200px,2.2fr)_minmax(80px,0.5fr)_80px] gap-4 py-4"
            >
              {[...Array(6)].map((_, j) => (
                <div
                  key={j}
                  className="h-4 w-full animate-pulse rounded bg-neutral-gray1"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
