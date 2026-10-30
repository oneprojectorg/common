import { type NormalizedRole, checkPermission, permission } from 'access-zones';

import {
  type RedactableInstanceData,
  redactHiddenBudget,
} from './templateBudget';

export const canSeeHiddenBudget = (roles: NormalizedRole[]): boolean =>
  checkPermission({ decisions: permission.ADMIN }, roles) ||
  checkPermission({ profile: permission.ADMIN }, roles);

export function redactHiddenBudgetForViewer<T extends RedactableInstanceData>(
  instanceData: T,
  roles: NormalizedRole[],
): T {
  return canSeeHiddenBudget(roles)
    ? instanceData
    : redactHiddenBudget(instanceData);
}
