import { relations } from 'drizzle-orm';
import { index, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { accessRoles } from './access.sql';

export const accessZones = pgTable(
  'access_zones',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 500 }),
    ...timestamps,
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);

export const accessZonesRelations = relations(
  accessZones,
  ({ many }) => ({
    rolePermissions: many(accessRolePermissionsOnAccessZones),
  }),
);

export const accessRolePermissionsOnAccessZones = pgTable(
  'access_role_permissions_on_access_zones',
  {
    id: autoId().primaryKey(),
    accessRoleId: uuid()
      .notNull()
      .references(() => accessRoles.id, {
        onDelete: 'cascade',
      }),
    accessZoneId: uuid()
      .notNull()
      .references(() => accessZones.id, {
        onDelete: 'cascade',
      }),
    permission: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.accessRoleId).concurrently(),
    index().on(table.accessZoneId).concurrently(),
    index().on(table.accessRoleId, table.accessZoneId).concurrently(),
  ],
);

export const accessRolePermissionsOnAccessZonesRelations = relations(
  accessRolePermissionsOnAccessZones,
  ({ one }) => ({
    accessRole: one(accessRoles, {
      fields: [accessRolePermissionsOnAccessZones.accessRoleId],
      references: [accessRoles.id],
    }),
    accessZone: one(accessZones, {
      fields: [accessRolePermissionsOnAccessZones.accessZoneId],
      references: [accessZones.id],
    }),
  }),
);