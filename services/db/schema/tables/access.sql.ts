import { index, integer, pgTable, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

export const accessRoles = pgTable(
  'access_roles',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 255 }),
    access: integer(),
    ...timestamps,
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);
