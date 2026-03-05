'use client';

import { trpc } from '@op/api/client';
import type { ProfileInvite, ProfileUser } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { EmptyState } from '@op/ui/EmptyState';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Note } from '@op/ui/Note';
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
import { useState } from 'react';
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
  processName,
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

  const hasPendingLaunchInvites = invites.some((invite) => !invite.notified);

  const content = isMobile ? (
    <MobileProfileUsersContent
      profileUsers={profileUsers}
      profileId={profileId}
      isLoading={isLoading}
      roles={roles}
      invites={invites}
      processName={processName}
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
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {hasPendingLaunchInvites && (
        <Note variant="banner" intent="warning">
          {t(
            'This process is still in draft. Participants with edit access will be invited immediately, Participant invites without edit access will be sent when the process launches.',
          )}
        </Note>
      )}
      {content}
    </div>
  );
};

const InviteStatusLabel = ({ notified }: { notified: boolean }) => {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-gray4">{t('Invited')}</span>
      {!notified && (
        <span className="text-sm text-neutral-gray4">
          {t('Pending launch')}
        </span>
      )}
    </div>
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
  userName,
  processName,
  className = 'sm:w-32',
}: {
  profileUserId: string;
  currentRoleId?: string;
  profileId: string;
  roles: { id: string; name: string }[];
  userName: string;
  processName?: string;
  className?: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);

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

  const removeUser = trpc.profile.removeUser.useMutation({
    onSuccess: () => {
      toast.success({ message: t('User removed from process') });
      void utils.profile.listUsers.invalidate({ profileId });
      setIsRemoveModalOpen(false);
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to remove user'),
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

  const isPending = updateRoles.isPending || removeUser.isPending;

  return (
    <>
      <Select
        aria-label={t('Role')}
        selectedKey={currentRoleId || ''}
        onSelectionChange={(key) => {
          const keyStr = key as string;
          if (keyStr === 'remove') {
            setIsRemoveModalOpen(true);
          } else {
            handleRoleChange(keyStr);
          }
        }}
        isDisabled={isPending}
        size="small"
        className={className}
      >
        {roles.map((role) => (
          <SelectItem key={role.id} id={role.id}>
            {role.name}
          </SelectItem>
        ))}
        <SelectItem id="remove" className="text-functional-red">
          {t('Remove from process')}
        </SelectItem>
      </Select>
      <DialogTrigger
        isOpen={isRemoveModalOpen}
        onOpenChange={setIsRemoveModalOpen}
      >
        <Modal isDismissable>
          <ModalHeader>{t('Remove {name}', { name: userName })}</ModalHeader>
          <ModalBody>
            <p>
              {processName
                ? t(
                    'Are you sure you want to remove {name} from "{processName}"?',
                    { name: userName, processName },
                  )
                : t(
                    'Are you sure you want to remove {name} from this process?',
                    { name: userName },
                  )}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="secondary"
              className="w-full sm:w-fit"
              onPress={() => setIsRemoveModalOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              color="destructive"
              className="w-full sm:w-fit"
              onPress={() => removeUser.mutate({ profileUserId })}
              isDisabled={removeUser.isPending}
            >
              {removeUser.isPending ? t('Removing...') : t('Remove')}
            </Button>
          </ModalFooter>
        </Modal>
      </DialogTrigger>
    </>
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
      toast.success({ message: t('Role updated successfully') });
      void utils.profile.listProfileInvites.invalidate({ profileId });
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to update role'),
      });
    },
  });

  const deleteInvite = trpc.profile.deleteProfileInvite.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Invite removed from process') });
      void utils.profile.listProfileInvites.invalidate({ profileId });
      setIsRemoveModalOpen(false);
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to remove invite'),
      });
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
    <>
      <Select
        aria-label={t('Role')}
        selectedKey={currentRoleId}
        onSelectionChange={(key) => {
          const keyStr = key as string;
          if (keyStr === 'remove') {
            setIsRemoveModalOpen(true);
          } else {
            handleRoleChange(keyStr);
          }
        }}
        isDisabled={isPending}
        size="small"
        className={className}
      >
        {roles.map((role) => (
          <SelectItem key={role.id} id={role.id}>
            {role.name}
          </SelectItem>
        ))}
        <SelectItem id="remove" className="text-functional-red">
          {t('Remove from process')}
        </SelectItem>
      </Select>
      <DialogTrigger
        isOpen={isRemoveModalOpen}
        onOpenChange={setIsRemoveModalOpen}
      >
        <Modal isDismissable>
          <ModalHeader>{t('Remove {name}', { name: inviteeName })}</ModalHeader>
          <ModalBody>
            <p>
              {processName
                ? t(
                    'Are you sure you want to remove {name} from "{processName}"?',
                    { name: inviteeName, processName },
                  )
                : t(
                    'Are you sure you want to remove {name} from this process?',
                    { name: inviteeName },
                  )}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="secondary"
              className="w-full sm:w-fit"
              onPress={() => setIsRemoveModalOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              color="destructive"
              className="w-full sm:w-fit"
              onPress={() => deleteInvite.mutate({ inviteId })}
              isDisabled={deleteInvite.isPending}
            >
              {deleteInvite.isPending ? t('Removing...') : t('Remove')}
            </Button>
          </ModalFooter>
        </Modal>
      </DialogTrigger>
    </>
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
        userName={displayName}
        processName={processName}
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
}: {
  invite: ProfileInvite;
  profileId: string;
  roles: { id: string; name: string }[];
  processName?: string;
}) => {
  const displayName = invite.inviteeProfile?.name ?? invite.email;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-neutral-gray1 p-4">
      <div className="flex gap-4">
        <ProfileAvatar profile={invite.inviteeProfile} className="size-10" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-col">
            <span className="text-base text-neutral-black">{displayName}</span>
            <InviteStatusLabel notified={invite.notified} />
          </div>
          <span className="truncate text-base text-neutral-black">
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
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  isLoading: boolean;
  roles: { id: string; name: string }[];
  invites: ProfileInvite[];
  processName?: string;
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
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
  roles: { id: string; name: string }[];
  invites: ProfileInvite[];
  processName?: string;
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

            return (
              <TableRow key={`invite-${invite.id}`} id={`invite-${invite.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProfileAvatar profile={invite.inviteeProfile} />
                    <div className="flex flex-col">
                      <span className="text-base text-neutral-black">
                        {displayName}
                      </span>
                      <InviteStatusLabel notified={invite.notified} />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-base text-neutral-black">
                    {invite.email}
                  </span>
                </TableCell>
                <TableCell className="text-right">
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
                    userName={displayName}
                    processName={processName}
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
