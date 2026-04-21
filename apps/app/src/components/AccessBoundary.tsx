'use client';

import { useUser } from '@/utils/UserProvider';
import { ReactNode } from 'react';

type Permissions = ReturnType<
  ReturnType<typeof useUser>['getPermissionsForProfile']
>;

export type AccessBoundaryCondition = {
  [Zone in keyof Permissions]?: Partial<Permissions[Zone]>;
};

export interface AccessBoundaryProps {
  required: AccessBoundaryCondition | AccessBoundaryCondition[];
  profileId?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function AccessBoundary({
  required,
  profileId,
  fallback = null,
  children,
}: AccessBoundaryProps) {
  const { user, getPermissionsForProfile } = useUser();
  const targetProfileId = profileId ?? user.currentProfileId;

  if (!targetProfileId) {
    return <>{fallback}</>;
  }

  const userPermissions = getPermissionsForProfile(targetProfileId);
  const conditions = Array.isArray(required) ? required : [required];

  const hasAccess = conditions.some((condition) =>
    Object.entries(condition).every(([zone, needs]) => {
      if (!needs) {
        return true;
      }
      const zonePermission = userPermissions[zone as keyof Permissions];
      if (!zonePermission) {
        return false;
      }
      return Object.entries(needs).every(
        ([action, needed]) =>
          !needed || zonePermission[action as keyof typeof zonePermission],
      );
    }),
  );

  return <>{hasAccess ? children : fallback}</>;
}
