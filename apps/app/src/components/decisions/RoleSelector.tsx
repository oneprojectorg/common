'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';

import { useTranslations } from '@/lib/i18n';

interface RoleSelectorProps {
  roles: Array<{ id: string; name: string }>;
  selectedRoleId: string;
  onSelectionChange: (roleId: string) => void;
  countsByRole: Record<string, number>;
}

/** Displays role tabs and their participant counts. */
export const RoleSelector = ({
  roles,
  selectedRoleId,
  onSelectionChange,
  countsByRole,
}: RoleSelectorProps) => {
  const t = useTranslations();

  return (
    <Tabs
      selectedKey={selectedRoleId}
      onSelectionChange={(key) => onSelectionChange(String(key))}
    >
      <TabList aria-label={t('Select a role')}>
        {roles.map((role) => {
          const count = countsByRole[role.id] ?? 0;
          return (
            <Tab key={role.id} id={role.id}>
              <span className="flex items-center gap-1">
                {t('{roleName} plural', { roleName: role.name })}
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
      <Skeleton className="h-8 w-20 rounded-lg" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  );
};
