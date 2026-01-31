'use client';

import { trpc } from '@op/api/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { Key, useEffect, useMemo, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

export const RoleSelector = ({
  profileId,
  selectedRoleId,
  onSelectionChange,
  selectedCount,
  onRolesLoaded,
}: {
  profileId: string;
  selectedRoleId: string;
  onSelectionChange: (key: Key) => void;
  selectedCount: number;
  onRolesLoaded: (firstRoleId: string) => void;
}) => {
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
  const firstRoleId = roles[0]?.id;
  useEffect(() => {
    if (!hasInitialized.current && firstRoleId && !selectedRoleId) {
      hasInitialized.current = true;
      onRolesLoaded(firstRoleId);
    }
  }, [firstRoleId, selectedRoleId, onRolesLoaded]);

  return (
    <Tabs selectedKey={selectedRoleId} onSelectionChange={onSelectionChange}>
      <TabList>
        {roles.map((role) => (
          <Tab key={role.id} id={role.id}>
            {role.name}
            {selectedCount > 0 && selectedRoleId === role.id ? (
              <span className="ml-1.5 min-w-4 rounded-full bg-teal-500 px-1.5 py-0.5 text-xs text-white">
                {selectedCount}
              </span>
            ) : null}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
};

export const RoleSelectorSkeleton = () => {
  const t = useTranslations();
  return (
    <div className="flex h-8 items-center">
      <LoadingSpinner className="size-4" />
      <span className="ml-2 text-sm text-neutral-gray4">
        {t('Loading roles...')}
      </span>
    </div>
  );
};
