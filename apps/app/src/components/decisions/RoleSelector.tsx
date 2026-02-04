'use client';

import { trpc } from '@op/api/client';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { Key, useEffect, useMemo, useRef } from 'react';

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
  onSelectionChange: (key: Key) => void;
  countsByRole: Record<string, number>;
  onRolesLoaded: (roleId: string, roleName: string) => void;
  onRoleNameChange: (roleName: string) => void;
}) => {
  const t = useTranslations();
  const [[globalRolesData, profileRolesData]] = trpc.useSuspenseQueries((t) => [
    t.profile.listRoles({}),
    t.profile.listRoles({ profileId }),
  ]);

  const roles = useMemo(() => {
    const globalRoles = globalRolesData.items ?? [];
    const profileRoles = profileRolesData.items ?? [];
    return [...globalRoles, ...profileRoles];
  }, [globalRolesData, profileRolesData]);

  // Set default role on mount if none selected
  const hasInitialized = useRef(false);
  const firstRole = roles[0];
  useEffect(() => {
    if (!hasInitialized.current && firstRole && !selectedRoleId) {
      hasInitialized.current = true;
      onRolesLoaded(firstRole.id, firstRole.name);
    }
  }, [firstRole, selectedRoleId, onRolesLoaded]);

  const handleSelectionChange = (key: Key) => {
    const role = roles.find((r) => r.id === key);
    if (role) {
      onRoleNameChange(role.name);
    }
    onSelectionChange(key);
  };

  return (
    <Tabs
      selectedKey={selectedRoleId}
      onSelectionChange={handleSelectionChange}
    >
      <TabList aria-label={t('Select a role')}>
        {roles.map((role) => {
          const count = countsByRole[role.id] ?? 0;
          return (
            <Tab key={role.id} id={role.id}>
              <span className="flex items-center gap-1">
                {role.name}
                {count > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-teal px-1 text-xs text-neutral-offWhite">
                    {count}
                  </span>
                )}
              </span>
            </Tab>
          );
        })}
      </TabList>
    </Tabs>
  );
};

export const RoleSelectorSkeleton = () => {
  return (
    <div className="flex gap-4">
      <Skeleton className="h-8 w-20 rounded-md" />
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  );
};
