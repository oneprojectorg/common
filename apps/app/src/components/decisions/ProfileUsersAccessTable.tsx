'use client';

import { trpc } from '@op/api/client';
import type { profileUserEncoder } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
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
import { useEffect, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { LuCircleAlert } from 'react-icons/lu';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '@/components/ProfileAvatar';

// Infer the ProfileUser type from the encoder
type ProfileUser = z.infer<typeof profileUserEncoder>;

const getProfileUserStatus = (profileUser: ProfileUser): string => {
  // Check for status field if available, otherwise derive from data
  if ('status' in profileUser && typeof profileUser.status === 'string') {
    // Capitalize first letter
    return (
      profileUser.status.charAt(0).toUpperCase() + profileUser.status.slice(1)
    );
  }
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

// Hook to detect client-side hydration (workaround for React Aria Table SSR issue)
// See: https://github.com/adobe/react-spectrum/issues/4870
const useIsHydrated = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  return isHydrated;
};

// Inner table content component
const ProfileUsersAccessTableContent = ({
  profileUsers,
  profileId,
  sortDescriptor,
  onSortChange,
  isLoading,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
}) => {
  const t = useTranslations();
  const isHydrated = useIsHydrated();

  // Fetch roles with regular query
  const {
    data: rolesData,
    isPending: rolesPending,
    isError: rolesError,
  } = trpc.organization.getRoles.useQuery();

  // Don't render table until after hydration due to React Aria SSR limitations
  if (!isHydrated || rolesPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (rolesError) {
    return null; // Error handled by parent
  }

  const roles = rolesData?.roles ?? [];

  return (
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
          <TableColumn id="role" allowsSorting className="w-[140px] text-right">
            {t('Role')}
          </TableColumn>
        </TableHeader>
        <TableBody>
          {profileUsers.map((profileUser) => {
            const displayName =
              profileUser.profile?.name ||
              profileUser.name ||
              profileUser.email.split('@')[0];
            const currentRole = profileUser.roles[0];
            const status = getProfileUserStatus(profileUser);

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
  );
};

const MembersLoadError = ({ onRetry }: { onRetry: () => void }) => {
  const t = useTranslations();
  return (
    <div className="flex min-h-40 w-full flex-col items-center justify-center py-6">
      <div className="flex flex-col items-center justify-center gap-3 text-neutral-gray4">
        <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
          <LuCircleAlert />
        </div>
        <span>{t('Members could not be loaded')}</span>
        <Button onPress={onRetry} color="secondary" size="small">
          {t('Try again')}
        </Button>
      </div>
    </div>
  );
};

// Exported component with loading and error states
export const ProfileUsersAccessTable = ({
  profileUsers,
  profileId,
  sortDescriptor,
  onSortChange,
  isLoading,
  isError,
  onRetry,
}: {
  profileUsers: ProfileUser[];
  profileId: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) => {
  if (isError) {
    return <MembersLoadError onRetry={onRetry} />;
  }

  return (
    <ProfileUsersAccessTableContent
      profileUsers={profileUsers}
      profileId={profileId}
      sortDescriptor={sortDescriptor}
      onSortChange={onSortChange}
      isLoading={isLoading}
    />
  );
};
