import {
  boolean,
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { organizations } from './organizations.sql';

export const organizationRelationships = pgTable(
  'organization_relationships',
  {
    id: autoId().primaryKey(),
    sourceOrganizationId: uuid('source_organization_id')
      .notNull()
      .references(() => organizations.id),
    targetOrganizationId: uuid('target_organization_id')
      .notNull()
      .references(() => organizations.id),
    relationshipType: varchar({ length: 255 }).notNull(),
    pending: boolean(),
    metadata: jsonb('metadata'),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.sourceOrganizationId).concurrently(),
    index().on(table.targetOrganizationId).concurrently(),
    index().on(table.relationshipType).concurrently(),
    uniqueIndex().on(
      table.sourceOrganizationId,
      table.targetOrganizationId,
      table.relationshipType,
    ),
  ],
);
