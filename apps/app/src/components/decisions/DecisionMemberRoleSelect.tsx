'use client';

import { trpc } from '@op/api/client';
import { Select, SelectItem } from '@op/ui/Select';
import { toast } from '@op/ui/Toast';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

const RoleSelectContent = ({
  memberId,
  currentRoleId,
  profileId,
}: {
  memberId: string;
  currentRoleId?: string;
  profileId: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [rolesData] = trpc.organization.getRoles.useSuspenseQuery();

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
      className="w-32"
    >
      {rolesData.roles.map((role) => (
        <SelectItem key={role.id} id={role.id}>
          {role.name}
        </SelectItem>
      ))}
    </Select>
  );
};

export const DecisionMemberRoleSelect = (props: {
  memberId: string;
  currentRoleId?: string;
  profileId: string;
}) => {
  return (
    <Suspense
      fallback={
        <div className="h-10 w-32 animate-pulse rounded-md bg-neutral-gray1" />
      }
    >
      <RoleSelectContent {...props} />
    </Suspense>
  );
};
