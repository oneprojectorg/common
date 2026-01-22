'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { RouterOutput } from '@op/api/client';
import { trpc } from '@op/api/client';
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
import type { SortDescriptor } from 'react-aria-components';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '@/components/ProfileAvatar';

// Infer the Member type from the tRPC router output
type Member = RouterOutput['profile']['listUsers'][number];

const getMemberStatus = (member: Member): string => {
  // Check for status field if available, otherwise derive from data
  if ('status' in member && typeof member.status === 'string') {
    // Capitalize first letter
    return member.status.charAt(0).toUpperCase() + member.status.slice(1);
  }
  // Default to "Active" for existing members
  return 'Active';
};

const MemberRoleSelect = ({
  memberId,
  currentRoleId,
  profileId,
  roles,
}: {
  memberId: string;
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
        profileUserId: memberId,
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

// Inner component that uses suspense query - Suspense boundary is OUTSIDE the table
const DecisionMembersTableContent = ({
  members,
  profileId,
}: {
  members: Member[];
  profileId: string;
}) => {
  const t = useTranslations();
  const isHydrated = useIsHydrated();
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'name',
    direction: 'ascending',
  });

  // Fetch roles once at table level with suspense - boundary is outside this component
  const [rolesData] = trpc.organization.getRoles.useSuspenseQuery();

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortDescriptor.column) {
        case 'name':
          aValue = a.profile?.name || a.name || a.email.split('@')[0] || '';
          bValue = b.profile?.name || b.name || b.email.split('@')[0] || '';
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'role':
          aValue = a.roles[0]?.name || '';
          bValue = b.roles[0]?.name || '';
          break;
        default:
          return 0;
      }

      const comparison = aValue.localeCompare(bValue);
      return sortDescriptor.direction === 'descending'
        ? -comparison
        : comparison;
    });
  }, [members, sortDescriptor]);

  // Don't render table until after hydration due to React Aria SSR limitations
  if (!isHydrated) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Table
      aria-label={t('Members list')}
      className="w-full table-fixed"
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
    >
      <TableHeader>
        <TableColumn isRowHeader id="name" allowsSorting className="w-[200px]">
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
        {sortedMembers.map((member) => {
          const displayName =
            member.profile?.name || member.name || member.email.split('@')[0];
          const currentRole = member.roles[0];
          const status = getMemberStatus(member);

          return (
            <TableRow key={member.id} id={member.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ProfileAvatar profile={member.profile} withLink={false} />
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-black">
                      {displayName}
                    </span>
                    <span className="text-xs text-neutral-gray4">{status}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-neutral-black">
                  {member.email}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <MemberRoleSelect
                  memberId={member.id}
                  currentRoleId={currentRole?.id}
                  profileId={profileId}
                  roles={rolesData.roles}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const RolesLoadError = ({
  resetErrorBoundary,
}: {
  resetErrorBoundary?: () => void;
}) => {
  const t = useTranslations();
  return (
    <div className="flex min-h-40 w-full flex-col items-center justify-center py-6">
      <div className="flex flex-col items-center justify-center gap-3 text-neutral-gray4">
        <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
          <LuCircleAlert />
        </div>
        <span>{t('Roles could not be loaded')}</span>
        <Button onPress={resetErrorBoundary} color="secondary" size="small">
          {t('Try again')}
        </Button>
      </div>
    </div>
  );
};

// Exported component wraps with Suspense + ErrorBoundary OUTSIDE the table
export const DecisionMembersTable = ({
  members,
  profileId,
}: {
  members: Member[];
  profileId: string;
}) => {
  return (
    <APIErrorBoundary fallbacks={{ default: <RolesLoadError /> }}>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <DecisionMembersTableContent members={members} profileId={profileId} />
      </Suspense>
    </APIErrorBoundary>
  );
};
