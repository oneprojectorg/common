import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { serviceRolePolicies } from 'helpers';

import { locations } from './locations.sql';
import { organizations } from './organizations.sql';

export const organizationsWhereWeWork = pgTable(
  'organizations_where_we_work',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    ...serviceRolePolicies,
    pk: primaryKey(table.organizationId, table.locationId),
  }),
);
