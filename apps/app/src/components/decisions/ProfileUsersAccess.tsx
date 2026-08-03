'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import type { SortDir } from '@op/common';
import { useDebounce, useInfiniteScroll, useMediaQuery } from '@op/hooks';
import { Alert, AlertTitle, AlertDescription } from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import { Header2 } from '@op/sense/Header';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { Skeleton } from '@op/sense/Skeleton';
import { screens } from '@op/styles/constants';
import { useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { LuSearch, LuCircleAlert, LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileInviteModal } from './ProfileInviteModal';
import { ProfileUsersAccessTable } from './ProfileUsersAccessTable';

// Sort columns supported by profile.listUsers endpoint
type SortColumn = 'name' | 'email' | 'role';

const ITEMS_PER_PAGE = 25;

export const ProfileUsersAccess = ({
  profileId,
  instanceId,
  processName,
}: {
  profileId: string;
  instanceId: string;
  processName?: string;
}) => {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'name',
    direction: 'ascending',
  });

  const orderBy = sortDescriptor.column as SortColumn;
  const dir: SortDir =
    sortDescriptor.direction === 'ascending' ? 'asc' : 'desc';
  const searchFilter = debouncedQuery.length >= 2 ? debouncedQuery : undefined;

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.profile.listUsers.useInfiniteQuery(
    {
      profileId,
      limit: ITEMS_PER_PAGE,
      orderBy,
      dir,
      query: searchFilter,
    },
    {
      getNextPageParam: (lastPage) => lastPage.next,
    },
  );

  const { ref: scrollTriggerRef, shouldShowTrigger } = useInfiniteScroll(
    fetchNextPage,
    { hasNextPage, isFetchingNextPage },
  );

  // Fetch profile-specific roles for this decision instance
  const { data: rolesData, isPending: rolesPending } =
    trpc.profile.listRoles.useQuery({ profileId });

  // Check if process is in draft status
  const { data: instance } = trpc.decision.getInstance.useQuery({
    instanceId,
  });
  const isDraft = instance?.status === ProcessStatus.DRAFT;

  // Fetch pending invites to show alongside accepted members, filtered by search
  const { data: invites } = trpc.profile.listProfileInvites.useQuery(
    {
      profileId,
      query: searchFilter,
    },
    { retry: false },
  );

  const profileUsers = data?.pages.flatMap((page) => page.items) ?? [];
  const roles = rolesData?.items ?? [];

  return (
    <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
      <div className="flex flex-col gap-10">
        <div className="flex items-center justify-between gap-4">
          <Header2 className="font-serif text-title-sm">
            {t('Manage Participants')}
          </Header2>
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <LuUserPlus className="size-4" />
            {t('Invite')}
          </Button>
        </div>

        {isDraft && (
          <Alert variant="warning">
            <LuCircleAlert />
            <AlertTitle>{t('Invites will send when you launch')}</AlertTitle>
            <AlertDescription>
              {t(
                'This process is still in draft. Participants with "Manage Process" access will be invited immediately. Everyone else is invited when the process launches.',
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <InputGroup className="w-full md:max-w-96">
            <InputGroupAddon>
              <LuSearch className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t('Search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>

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
            invites={invites ?? []}
            processName={processName}
            isDraft={isDraft}
          />

          {shouldShowTrigger && (
            <div ref={scrollTriggerRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <div className="flex w-full items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              )}
            </div>
          )}
        </div>

        <ProfileInviteModal
          profileId={profileId}
          isDraft={isDraft}
          isOpen={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
        />
      </div>
    </ClientOnly>
  );
};
