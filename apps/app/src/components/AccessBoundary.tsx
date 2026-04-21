'use client';

import { isPermissionAction, useUser } from '@/utils/UserProvider';
import type { ZonePermissions } from 'access-zones';
import { ReactNode } from 'react';

export type AccessBoundaryCondition = {
  [Zone in keyof ZonePermissions]?: Partial<ZonePermissions[Zone]>;
};

export interface AccessBoundaryProps {
  required: AccessBoundaryCondition | AccessBoundaryCondition[];
  profileId: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function AccessBoundary({
  required,
  profileId,
  fallback = null,
  children,
}: AccessBoundaryProps) {
  const { getPermissionsForProfile } = useUser();
  const userPermissions: ZonePermissions = getPermissionsForProfile(profileId);
  const conditions = Array.isArray(required) ? required : [required];

  const hasAccess = conditions.some((condition) =>
    Object.entries(condition).every(([zone, needs]) => {
      if (!needs) {
        return true;
      }
      const zonePermission = userPermissions[zone];
      if (!zonePermission) {
        return false;
      }
      return Object.entries(needs).every(([action, needed]) => {
        if (!needed) {
          return true;
        }
        if (!isPermissionAction(action)) {
          return false;
        }
        return zonePermission[action];
      });
    }),
  );

  return <>{hasAccess ? children : fallback}</>;
}
