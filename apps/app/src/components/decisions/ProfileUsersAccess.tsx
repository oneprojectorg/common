'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import type { SortDir } from '@op/common/client';
import { useDebounce, useInfiniteScroll, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { AlertBanner } from '@op/ui/AlertBanner';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { SearchField } from '@op/ui/SearchField';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { LuUserPlus } from 'react-icons/lu';

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
      <div className="flex flex-col gap-4">
        <Header2 className="font-serif text-title-sm">
          {t('Manage Participants')}
        </Header2>

        {isDraft && (
          <AlertBanner variant="banner" intent="warning">
            {t(
              'This process is still in draft. Participants with "Manage Process" access will be invited immediately. Invites without edit access will be sent when the process launches.',
            )}
          </AlertBanner>
        )}

        <div className="flex items-center justify-between gap-4">
          <SearchField
            placeholder={t('Search')}
            value={searchQuery}
            onChange={setSearchQuery}
            size={isMobile ? 'small' : undefined}
            className="w-full md:max-w-96"
          />
          <Button
            color="secondary"
            size="small"
            onPress={() => setIsInviteModalOpen(true)}
          >
            <LuUserPlus className="size-4" />
            {t('Invite')}
          </Button>
        </div>

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
        />

        {shouldShowTrigger && (
          <div
            ref={scrollTriggerRef as React.RefObject<HTMLDivElement>}
            className="flex justify-center py-4"
          >
            {isFetchingNextPage && <SkeletonLine lines={3} />}
          </div>
        )}

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
