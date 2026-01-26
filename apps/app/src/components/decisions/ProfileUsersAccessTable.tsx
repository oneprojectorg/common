'use client';

import { trpc } from '@op/api/client';
import type { ProfileUser } from '@op/api/encoders';
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

import { useTranslations } from '@/lib/i18n';
import { ClientOnly } from '@/utils/ClientOnly';

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
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  roles: { id: string; name: string }[];
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

  if (profileUsers.length === 0 && !isLoading) {
    return (
      <EmptyState icon={<LuUsers className="size-6" />}>
        <span>{t('No members found')}</span>
      </EmptyState>
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
}: {
  profileUserId: string;
  currentRoleId?: string;
  profileId: string;
  roles: { id: string; name: string }[];
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
      className="w-32"
    >
      {roles.map((role) => (
        <SelectItem key={role.id} id={role.id}>
          {role.name}
        </SelectItem>
      ))}
    </Select>
  );
};

// Inner table content component
const ProfileUsersAccessTableContent = ({
  profileUsers,
  profileId,
  sortDescriptor,
  onSortChange,
  isLoading,
  roles,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
  roles: { id: string; name: string }[];
}) => {
  const t = useTranslations();

  return (
    <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <Skeleton className="h-8 w-32" />
          </div>
        )}
        <Table
          aria-label={t('Members list')}
          className="w-full table-fixed"
          sortDescriptor={sortDescriptor}
          onSortChange={onSortChange}
        >
          <TableHeader>
            <TableColumn
              isRowHeader
              id="name"
              allowsSorting
              className="w-[200px]"
            >
              {t('Name')}
            </TableColumn>
            <TableColumn id="email" allowsSorting className="w-auto">
              {t('Email')}
            </TableColumn>
            <TableColumn
              id="role"
              allowsSorting
              className="w-[140px] text-right"
            >
              {t('Role')}
            </TableColumn>
          </TableHeader>
          <TableBody>
            {profileUsers.map((profileUser) => {
              const displayName =
                profileUser.profile?.name ||
                profileUser.name ||
                (profileUser.email?.split('@')?.[0] ?? 'Unknown');
              const currentRole = profileUser.roles[0];
              const status = getProfileUserStatus();

              return (
                <TableRow key={profileUser.id} id={profileUser.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProfileAvatar
                        profile={profileUser.profile}
                        withLink={false}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-black">
                          {displayName}
                        </span>
                        <span className="text-xs text-neutral-gray4">
                          {status}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-black">
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
    </ClientOnly>
  );
};
