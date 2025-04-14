import { index, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { serviceRolePolicies } from '../../helpers/policies';

export const accessRoles = pgTable(
  'access_roles',
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 255 }),
    access: integer(),
  },
  table => [...serviceRolePolicies, index().on(table.id).concurrently()],
);
