'use client';

import { BadgeNumber } from '@op/sense/Badge';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';

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
      className="scrollbar-none w-full overflow-x-auto border-b"
      value={selectedRoleId}
      onValueChange={onSelectionChange}
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
