import type { Role } from '@op/api/encoders';

/** Admin roles render last: the first tab is the default, and admin must not be it. */
export const getRolesInTabOrder = (roles: ReadonlyArray<Role>): Array<Role> => [
  ...roles.filter((role) => !role.permissions?.admin),
  ...roles.filter((role) => role.permissions?.admin),
];
