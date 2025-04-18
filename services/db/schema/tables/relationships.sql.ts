import { index, integer, pgTable, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

import { organizations } from './organizations.sql';

export const organizationRelationships = pgTable(
  'organization_relationships',
  {
    id: autoId().primaryKey(),
    sourceOrganizationId: integer('source_organization_id')
      .notNull()
      .references(() => organizations.id),
    targetOrganizationId: integer('target_organization_id')
      .notNull()
      .references(() => organizations.id),
    relationshipType: varchar({ length: 255 }).notNull(),
    ...timestamps,
  },
  table => [
    ...serviceRolePolicies,
    index().on(table.sourceOrganizationId).concurrently(),
    index().on(table.targetOrganizationId).concurrently(),
    index().on(table.relationshipType).concurrently(),
  ],
);
