'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { trpc } from '@op/api/client';
import type { ProfileInvite } from '@op/api/encoders';
import type { ProfileUser } from '@op/common/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
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
import { useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuCircleAlert,
  LuUsers,
} from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '@/components/ProfileAvatar';

// Sort columns supported by the profile.listUsers endpoint
type SortColumn = 'name' | 'email' | 'role';

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
  processName,
  isDraft,
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
  processName?: string;
  isDraft: boolean;
}) => {
  const t = useTranslations();

  if (isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('Members could not be loaded')}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRetry} variant="outline" size="sm">
            {t('Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (profileUsers.length === 0 && invites.length === 0 && !isLoading) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuUsers className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('No members found')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return isMobile ? (
    <MobileProfileUsersContent
      profileUsers={profileUsers}
      profileId={profileId}
      isLoading={isLoading}
      roles={roles}
      invites={invites}
      processName={processName}
      isDraft={isDraft}
    />
  ) : (
    <ProfileUsersAccessTableContent
      profileUsers={profileUsers}
      profileId={profileId}
      sortDescriptor={sortDescriptor}
      onSortChange={onSortChange}
      isLoading={isLoading}
      roles={roles}
      invites={invites}
      processName={processName}
      isDraft={isDraft}
    />
  );
};

const InviteStatusLabel = ({
  notifiedAt,
  isDraft,
}: {
  notifiedAt: string | null;
  isDraft: boolean;
}) => {
  const t = useTranslations();
  const isPendingLaunch = isDraft && !notifiedAt;
  return (
    <span className="text-sm text-muted-foreground">
      {isPendingLaunch ? t('Pending launch') : t('Invited')}
    </span>
  );
};

const getProfileUserStatus = (): string => {
  // TODO: We need this logic in the backend
  // Default to "Active" for existing profile users
  return 'Active';
};

// Shared confirmation for removing a member or a pending invite from the process.
const RemoveFromProcessDialog = ({
  open,
  onOpenChange,
  name,
  processName,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  processName?: string;
  onConfirm: () => void;
  isPending: boolean;
}) => {
  const t = useTranslations();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-red-50">
            <LuCircleAlert className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('Remove {name}?', { name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {processName
              ? t(
                  'Are you sure you want to remove {name} from "{processName}"?',
                  {
                    name,
                    processName,
                  },
                )
              : t('Are you sure you want to remove {name} from this process?', {
                  name,
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? t('Removing...') : t('Remove')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Presentational role picker with a "Remove from process" option that opens a
// confirmation. Data adapters below (member / invite) wire the mutations.
const RoleSelectWithRemove = ({
  value,
  onRoleChange,
  roles,
  disabled,
  canRemove,
  removeOpen,
  onRemoveOpenChange,
  removeName,
  processName,
  onRemove,
  isRemoving,
}: {
  value: string;
  onRoleChange: (roleId: string) => void;
  roles: { id: string; name: string }[];
  disabled?: boolean;
  canRemove: boolean;
  removeOpen: boolean;
  onRemoveOpenChange: (open: boolean) => void;
  removeName: string;
  processName?: string;
  onRemove: () => void;
  isRemoving: boolean;
  className?: string;
}) => {
  const t = useTranslations();
  const currentRoleName = roles.find((role) => role.id === value)?.name;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button
              variant="ghost"
              className="border border-input sm:border-none"
              aria-label={t('Role')}
            >
              <span>{currentRoleName ?? t('Role')}</span>
              <LuChevronDown className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={value} onValueChange={onRoleChange}>
            {roles.map((role) => (
              <DropdownMenuRadioItem key={role.id} value={role.id} closeOnClick>
                {role.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {canRemove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onRemoveOpenChange(true)}
              >
                {t('Remove from process')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canRemove && (
        <RemoveFromProcessDialog
          open={removeOpen}
          onOpenChange={onRemoveOpenChange}
          name={removeName}
          processName={processName}
          onConfirm={onRemove}
          isPending={isRemoving}
        />
      )}
    </>
  );
};

const ProfileUserRoleSelect = ({
  profileUserId,
  currentRoleId,
  profileId,
  roles,
  userName,
  processName,
  isOwner,
  className = 'sm:w-32',
}: {
  profileUserId: string;
  currentRoleId?: string;
  profileId: string;
  roles: { id: string; name: string }[];
  userName: string;
  processName?: string;
  isOwner?: boolean;
  className?: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);

  const updateRoles = trpc.profile.updateUserRoles.useMutation({
    onSuccess: () => {
      toast.success(t('Role updated successfully'));
      void utils.profile.listUsers.invalidate({ profileId });
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to update role'));
    },
  });

  const removeUser = trpc.profile.removeUser.useMutation({
    onSuccess: () => {
      toast.success(t('User removed from process'));
      void utils.profile.listUsers.invalidate({ profileId });
      setIsRemoveModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to remove user'));
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

  const isPending = updateRoles.isPending || removeUser.isPending;

  return (
    <RoleSelectWithRemove
      value={currentRoleId || ''}
      onRoleChange={handleRoleChange}
      roles={roles}
      disabled={isPending || isOwner}
      canRemove={!isOwner}
      removeOpen={isRemoveModalOpen}
      onRemoveOpenChange={setIsRemoveModalOpen}
      removeName={userName}
      processName={processName}
      onRemove={() => removeUser.mutate({ profileUserId })}
      isRemoving={removeUser.isPending}
      className={className}
    />
  );
};

const InviteRoleSelect = ({
  inviteId,
  currentRoleId,
  profileId,
  roles,
  inviteeName,
  processName,
  className = 'sm:w-32',
}: {
  inviteId: string;
  currentRoleId: string;
  profileId: string;
  roles: { id: string; name: string }[];
  inviteeName: string;
  processName?: string;
  className?: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);

  const updateInvite = trpc.profile.updateProfileInvite.useMutation({
    onSuccess: () => {
      toast.success(t('Role updated successfully'));
      void utils.profile.listProfileInvites.invalidate({ profileId });
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to update role'));
    },
  });

  const deleteInvite = trpc.profile.deleteProfileInvite.useMutation({
    onSuccess: () => {
      toast.success(t('Invite removed from process'));
      void utils.profile.listProfileInvites.invalidate({ profileId });
      setIsRemoveModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to remove invite'));
    },
  });

  const handleRoleChange = (roleId: string) => {
    if (roleId && roleId !== currentRoleId) {
      updateInvite.mutate({
        inviteId,
        accessRoleId: roleId,
      });
    }
  };

  const isPending = updateInvite.isPending || deleteInvite.isPending;

  return (
    <RoleSelectWithRemove
      value={currentRoleId}
      onRoleChange={handleRoleChange}
      roles={roles}
      disabled={isPending}
      canRemove
      removeOpen={isRemoveModalOpen}
      onRemoveOpenChange={setIsRemoveModalOpen}
      removeName={inviteeName}
      processName={processName}
      onRemove={() => deleteInvite.mutate({ inviteId })}
      isRemoving={deleteInvite.isPending}
      className={className}
    />
  );
};

const MobileProfileUserCard = ({
  profileUser,
  profileId,
  roles,
  processName,
}: {
  profileUser: ProfileUser;
  profileId: string;
  roles: { id: string; name: string }[];
  processName?: string;
}) => {
  const canLinkToProfile = useCanLinkToProfile();
  const displayName =
    profileUser.profile?.name ||
    profileUser.name ||
    (profileUser.email?.split('@')?.[0] ?? 'Unknown');
  const currentRole = profileUser.roles[0];
  const status = getProfileUserStatus();

  const profileSlug = profileUser.profile?.slug;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex gap-4">
        <ProfileAvatar profile={profileUser.profile} className="size-10" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-col">
            {profileSlug && canLinkToProfile ? (
              <Link
                href={`/profile/${profileSlug}`}
                className="text-base text-foreground hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <span className="text-base text-foreground">{displayName}</span>
            )}
            <span className="text-sm text-muted-foreground">{status}</span>
          </div>
          <span className="truncate text-base text-foreground">
            {profileUser.email}
          </span>
        </div>
      </div>
      <ProfileUserRoleSelect
        profileUserId={profileUser.id}
        currentRoleId={currentRole?.id}
        profileId={profileId}
        roles={roles}
        userName={displayName}
        processName={processName}
        isOwner={profileUser.isOwner}
        className="w-full"
      />
    </div>
  );
};

const MobileInviteCard = ({
  invite,
  profileId,
  roles,
  processName,
  isDraft,
}: {
  invite: ProfileInvite;
  profileId: string;
  roles: { id: string; name: string }[];
  processName?: string;
  isDraft: boolean;
}) => {
  const displayName = invite.inviteeProfile?.name ?? invite.email;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex gap-4">
        <ProfileAvatar
          profile={invite.inviteeProfile ?? { email: invite.email }}
          className="size-10"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-col">
            <span className="text-base text-foreground">{displayName}</span>
            <InviteStatusLabel
              notifiedAt={invite.notifiedAt}
              isDraft={isDraft}
            />
          </div>
          <span className="truncate text-base text-foreground">
            {invite.email}
          </span>
        </div>
      </div>
      <InviteRoleSelect
        inviteId={invite.id}
        currentRoleId={invite.accessRoleId}
        profileId={profileId}
        roles={roles}
        inviteeName={displayName}
        processName={processName}
        className="w-full"
      />
    </div>
  );
};

const MobileProfileUsersContent = ({
  profileUsers,
  profileId,
  isLoading,
  roles,
  invites,
  processName,
  isDraft,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  isLoading: boolean;
  roles: { id: string; name: string }[];
  invites: ProfileInvite[];
  processName?: string;
  isDraft: boolean;
}) => {
  return (
    <div className="flex flex-col gap-4">
      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && (
        <>
          {invites.map((invite) => (
            <MobileInviteCard
              key={invite.id}
              invite={invite}
              profileId={profileId}
              roles={roles}
              processName={processName}
              isDraft={isDraft}
            />
          ))}
          {profileUsers.map((profileUser) => (
            <MobileProfileUserCard
              key={profileUser.id}
              profileUser={profileUser}
              profileId={profileId}
              roles={roles}
              processName={processName}
            />
          ))}
        </>
      )}
    </div>
  );
};

// Clickable, sortable column header. sense Table has no built-in sort, so the
// sort state (a react-aria SortDescriptor) is driven manually here.
const SortableHead = ({
  column,
  label,
  sortDescriptor,
  onSortChange,
  className,
}: {
  column: SortColumn;
  label: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  className?: string;
}) => {
  const active = sortDescriptor.column === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="flex items-center gap-1"
        onClick={() =>
          onSortChange({
            column,
            direction:
              active && sortDescriptor.direction === 'ascending'
                ? 'descending'
                : 'ascending',
          })
        }
      >
        {label}
        {active &&
          (sortDescriptor.direction === 'ascending' ? (
            <LuArrowUp className="size-3" />
          ) : (
            <LuArrowDown className="size-3" />
          ))}
      </button>
    </TableHead>
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
  processName,
  isDraft,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
  roles: { id: string; name: string }[];
  invites: ProfileInvite[];
  processName?: string;
  isDraft: boolean;
}) => {
  const t = useTranslations();
  const canLinkToProfile = useCanLinkToProfile();

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      <Table aria-label={t('Participants list')} className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <SortableHead
              column="name"
              label={t('Name')}
              sortDescriptor={sortDescriptor}
              onSortChange={onSortChange}
              className="sm:w-52"
            />
            <SortableHead
              column="email"
              label={t('Email')}
              sortDescriptor={sortDescriptor}
              onSortChange={onSortChange}
              className="w-auto"
            />
            <SortableHead
              column="role"
              label={t('Role')}
              sortDescriptor={sortDescriptor}
              onSortChange={onSortChange}
              className="flex justify-end"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => {
            const displayName = invite.inviteeProfile?.name ?? invite.email;

            return (
              <TableRow key={`invite-${invite.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProfileAvatar
                      className="size-8"
                      profile={invite.inviteeProfile ?? { email: invite.email }}
                    />
                    <div className="flex flex-col">
                      <span className="text-base text-foreground">
                        {displayName}
                      </span>
                      <InviteStatusLabel
                        notifiedAt={invite.notifiedAt}
                        isDraft={isDraft}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-base text-foreground">
                    {invite.email}
                  </span>
                </TableCell>
                <TableCell className="text-end">
                  <InviteRoleSelect
                    inviteId={invite.id}
                    currentRoleId={invite.accessRoleId}
                    profileId={profileId}
                    roles={roles}
                    inviteeName={displayName}
                    processName={processName}
                  />
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
              <TableRow key={profileUser.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProfileAvatar
                      profile={profileUser.profile}
                      className="size-8"
                    />
                    <div className="flex flex-col">
                      {profileSlug && canLinkToProfile ? (
                        <Link
                          href={`/profile/${profileSlug}`}
                          className="text-base text-foreground hover:underline"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <span className="text-base text-foreground">
                          {displayName}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {status}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-base text-foreground">
                    {profileUser.email}
                  </span>
                </TableCell>
                <TableCell className="text-end">
                  <ProfileUserRoleSelect
                    profileUserId={profileUser.id}
                    currentRoleId={currentRole?.id}
                    profileId={profileId}
                    roles={roles}
                    userName={displayName}
                    processName={processName}
                    isOwner={profileUser.isOwner}
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
