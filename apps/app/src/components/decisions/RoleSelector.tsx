'use client';

import { trpc } from '@op/api/client';
import { BadgeNumber } from '@op/sense/Badge';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { useEffect, useMemo, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

export const RoleSelector = ({
  profileId,
  selectedRoleId,
  onSelectionChange,
  countsByRole,
  onRolesLoaded,
  onRoleNameChange,
}: {
  profileId: string;
  selectedRoleId: string;
  onSelectionChange: (key: string) => void;
  countsByRole: Record<string, number>;
  onRolesLoaded: (roleId: string, roleName: string) => void;
  onRoleNameChange: (roleName: string) => void;
}) => {
  const t = useTranslations();
  const [rolesData] = trpc.profile.listRoles.useSuspenseQuery({ profileId });

  const roles = useMemo(() => {
    return rolesData.items ?? [];
  }, [rolesData]);

  // Set default role on mount if none selected
  const hasInitialized = useRef(false);
  const firstRole = roles[0];
  useEffect(() => {
    if (!hasInitialized.current && firstRole && !selectedRoleId) {
      hasInitialized.current = true;
      onRolesLoaded(firstRole.id, firstRole.name);
    }
  }, [firstRole, selectedRoleId, onRolesLoaded]);

  const handleSelectionChange = (key: string) => {
    const role = roles.find((r) => r.id === key);
    if (role) {
      onRoleNameChange(role.name);
    }
    onSelectionChange(key);
  };

  return (
    <Tabs
      className="scrollbar-none w-full overflow-x-auto border-b"
      value={selectedRoleId}
      onValueChange={handleSelectionChange}
    >
      <TabsList variant="line" aria-label={t('Select a role')}>
        {roles.map((role) => {
          const count = countsByRole[role.id] ?? 0;
          return (
            <TabsTrigger key={role.id} value={role.id}>
              <span className="flex items-center gap-2">
                {t('{roleName} plural', { roleName: role.name })}
                {count > 0 && <BadgeNumber>{count}</BadgeNumber>}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
};

export const RoleSelectorSkeleton = () => {
  return (
    <div className="flex gap-4">
      <Skeleton className="h-8 w-20 rounded-lg" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  );
};
