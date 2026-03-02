'use client';

import { trpc } from '@op/api/client';
import type { ProfileInvite, ProfileUser } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Select, SelectItem } from '@op/ui/Select';
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
import type { SortDescriptor } from 'react-aria-components';
import { LuUsers } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '@/components/ProfileAvatar';

// Exported component with loading and error states
export const ProfileUsersAccessTable = ({
  profileUsers,
  profileId,
  sortDescriptor,
  onSortChange,
  isLoading,
  isError,
  onRetry,
  roles,
  isMobile,
  invites,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  roles: { id: string; name: string }[];
  isMobile: boolean;
  invites: ProfileInvite[];
}) => {
  const t = useTranslations();

  if (isError) {
    return (
      <EmptyState>
        <span>{t('Members could not be loaded')}</span>
        <Button onPress={onRetry} color="secondary" size="small">
          {t('Try again')}
        </Button>
      </EmptyState>
    );
  }

  if (profileUsers.length === 0 && invites.length === 0 && !isLoading) {
    return (
      <EmptyState icon={<LuUsers className="size-6" />}>
        <span>{t('No members found')}</span>
      </EmptyState>
    );
  }

  if (isMobile) {
    return (
      <MobileProfileUsersContent
        profileUsers={profileUsers}
        profileId={profileId}
        isLoading={isLoading}
        roles={roles}
        invites={invites}
      />
    );
  }

  return (
    <ProfileUsersAccessTableContent
      profileUsers={profileUsers}
      profileId={profileId}
      sortDescriptor={sortDescriptor}
      onSortChange={onSortChange}
      isLoading={isLoading}
      roles={roles}
      invites={invites}
    />
  );
};

const getProfileUserStatus = (): string => {
  // TODO: We need this logic in the backend
  // Default to "Active" for existing profile users
  return 'Active';
};

const ProfileUserRoleSelect = ({
  profileUserId,
  currentRoleId,
  profileId,
  roles,
  className = 'sm:w-32',
}: {
  profileUserId: string;
  currentRoleId?: string;
  profileId: string;
  roles: { id: string; name: string }[];
  className?: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const updateRoles = trpc.profile.updateUserRoles.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Role updated successfully') });
      void utils.profile.listUsers.invalidate({ profileId });
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to update role'),
      });
    },
  });

  const handleRoleChange = (roleId: string) => {
    if (roleId && roleId !== currentRoleId) {
      updateRoles.mutate({
        profileUserId,
        roleIds: [roleId],
      });
    }
  };

  return (
    <Select
      aria-label={t('Role')}
      selectedKey={currentRoleId || ''}
      onSelectionChange={(key) => handleRoleChange(key as string)}
      isDisabled={updateRoles.isPending}
      size="small"
      className={className}
    >
      {roles.map((role) => (
        <SelectItem key={role.id} id={role.id}>
          {role.name}
        </SelectItem>
      ))}
    </Select>
  );
};

const MobileProfileUserCard = ({
  profileUser,
  profileId,
  roles,
}: {
  profileUser: ProfileUser;
  profileId: string;
  roles: { id: string; name: string }[];
}) => {
  const displayName =
    profileUser.profile?.name ||
    profileUser.name ||
    (profileUser.email?.split('@')?.[0] ?? 'Unknown');
  const currentRole = profileUser.roles[0];
  const status = getProfileUserStatus();

  const profileSlug = profileUser.profile?.slug;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-neutral-gray1 p-4">
      <div className="flex gap-4">
        <ProfileAvatar profile={profileUser.profile} className="size-10" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-col">
            {profileSlug ? (
              <Link
                href={`/profile/${profileSlug}`}
                className="text-base text-neutral-black hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <span className="text-base text-neutral-black">
                {displayName}
              </span>
            )}
            <span className="text-sm text-neutral-gray4">{status}</span>
          </div>
          <span className="truncate text-base text-neutral-black">
            {profileUser.email}
          </span>
        </div>
      </div>
      <ProfileUserRoleSelect
        profileUserId={profileUser.id}
        currentRoleId={currentRole?.id}
        profileId={profileId}
        roles={roles}
        className="w-full"
      />
    </div>
  );
};

const MobileInviteCard = ({
  invite,
  roles,
}: {
  invite: ProfileInvite;
  roles: { id: string; name: string }[];
}) => {
  const t = useTranslations();
  const displayName = invite.inviteeProfile?.name ?? invite.email;
  const roleName = roles.find((r) => r.id === invite.accessRoleId)?.name;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-neutral-gray1 p-4">
      <div className="flex gap-4">
        <ProfileAvatar profile={invite.inviteeProfile} className="size-10" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-col">
            <span className="text-base text-neutral-black">{displayName}</span>
            <span className="text-sm text-neutral-gray4">{t('Invited')}</span>
          </div>
          <span className="truncate text-base text-neutral-black">
            {invite.email}
          </span>
        </div>
      </div>
      {roleName && (
        <span className="text-sm text-neutral-gray4">{roleName}</span>
      )}
    </div>
  );
};

const MobileProfileUsersContent = ({
  profileUsers,
  profileId,
  isLoading,
  roles,
  invites,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  isLoading: boolean;
  roles: { id: string; name: string }[];
  invites: ProfileInvite[];
}) => {
  return (
    <div className="flex flex-col gap-4">
      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && (
        <>
          {invites.map((invite) => (
            <MobileInviteCard key={invite.id} invite={invite} roles={roles} />
          ))}
          {profileUsers.map((profileUser) => (
            <MobileProfileUserCard
              key={profileUser.id}
              profileUser={profileUser}
              profileId={profileId}
              roles={roles}
            />
          ))}
        </>
      )}
    </div>
  );
};

// Desktop table content component
const ProfileUsersAccessTableContent = ({
  profileUsers,
  profileId,
  sortDescriptor,
  onSortChange,
  isLoading,
  roles,
  invites,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
  roles: { id: string; name: string }[];
  invites: ProfileInvite[];
}) => {
  const t = useTranslations();

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      <Table
        aria-label={t('Participants list')}
        className="w-full table-fixed"
        sortDescriptor={sortDescriptor}
        onSortChange={onSortChange}
      >
        <TableHeader>
          <TableColumn isRowHeader id="name" allowsSorting className="sm:w-52">
            {t('Name')}
          </TableColumn>
          <TableColumn id="email" allowsSorting className="w-auto">
            {t('Email')}
          </TableColumn>
          <TableColumn id="role" allowsSorting className="sm:w-36">
            {t('Role')}
          </TableColumn>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => {
            const displayName = invite.inviteeProfile?.name ?? invite.email;
            const roleName = roles.find(
              (r) => r.id === invite.accessRoleId,
            )?.name;

            return (
              <TableRow key={`invite-${invite.id}`} id={`invite-${invite.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProfileAvatar profile={invite.inviteeProfile} />
                    <div className="flex flex-col">
                      <span className="text-base text-neutral-black">
                        {displayName}
                      </span>
                      <span className="text-sm text-neutral-gray4">
                        {t('Invited')}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-base text-neutral-black">
                    {invite.email}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-neutral-gray4">{roleName}</span>
                </TableCell>
              </TableRow>
            );
          })}
          {profileUsers.map((profileUser) => {
            const displayName =
              profileUser.profile?.name ||
              profileUser.name ||
              (profileUser.email?.split('@')?.[0] ?? 'Unknown');
            const currentRole = profileUser.roles[0];
            const status = getProfileUserStatus();
            const profileSlug = profileUser.profile?.slug;

            return (
              <TableRow key={profileUser.id} id={profileUser.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProfileAvatar profile={profileUser.profile} />
                    <div className="flex flex-col">
                      {profileSlug ? (
                        <Link
                          href={`/profile/${profileSlug}`}
                          className="text-base text-neutral-black hover:underline"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <span className="text-base text-neutral-black">
                          {displayName}
                        </span>
                      )}
                      <span className="text-sm text-neutral-gray4">
                        {status}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-base text-neutral-black">
                    {profileUser.email}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <ProfileUserRoleSelect
                    profileUserId={profileUser.id}
                    currentRoleId={currentRole?.id}
                    profileId={profileId}
                    roles={roles}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
