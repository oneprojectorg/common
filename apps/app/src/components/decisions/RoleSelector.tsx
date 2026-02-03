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
  countsByRole,
  onRolesLoaded,
}: {
  profileId: string;
  selectedRoleId: string;
  onSelectionChange: (key: Key) => void;
  countsByRole: Record<string, number>;
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
