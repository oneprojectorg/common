import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { serviceRolePolicies } from 'helpers';

import { organizations } from './organizations.sql';
import { taxonomyTerms } from './taxonomies.sql';

export const organizationsWhereWeWork = pgTable(
  'organizations_where_we_work',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    taxonomyTermId: uuid('taxonomy_term_id')
      .notNull()
      .references(() => taxonomyTerms.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    ...serviceRolePolicies,
    pk: primaryKey(table.organizationId, table.taxonomyTermId),
  }),
);
