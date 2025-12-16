import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { organizations } from './organizations.sql';
import { profiles } from './profiles.sql';

export const profileRelationshipTypeEnum = pgEnum('profile_relationship_type', [
  'following',
  'likes',
]);

export const ProfileRelationshipType = {
  FOLLOWING: 'following',
  LIKES: 'likes',
} as const;

export type ProfileRelationshipType =
  (typeof ProfileRelationshipType)[keyof typeof ProfileRelationshipType];

export const organizationRelationships = pgTable(
  'organization_relationships',
  {
    id: autoId().primaryKey(),
    sourceOrganizationId: uuid('source_organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    targetOrganizationId: uuid('target_organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
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
    index().on(table.sourceOrganizationId, table.pending).concurrently(),
    index().on(table.targetOrganizationId, table.pending).concurrently(),
    index().on(table.relationshipType, table.pending).concurrently(),
    index()
      .on(table.sourceOrganizationId, table.targetOrganizationId)
      .concurrently(),
    uniqueIndex('org_rel_source_target_type_unique').on(
      table.sourceOrganizationId,
      table.targetOrganizationId,
      table.relationshipType,
    ),
  ],
);

export const organizationRelationshipsRelations = relations(
  organizationRelationships,
  ({ one }) => ({
    sourceOrganization: one(organizations, {
      fields: [organizationRelationships.sourceOrganizationId],
      references: [organizations.id],
    }),
    targetOrganization: one(organizations, {
      fields: [organizationRelationships.targetOrganizationId],
      references: [organizations.id],
    }),
  }),
);

export const profileRelationships = pgTable(
  'profile_relationships',
  {
    id: autoId().primaryKey(),
    sourceProfileId: uuid('source_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    targetProfileId: uuid('target_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    relationshipType:
      profileRelationshipTypeEnum('relationship_type').notNull(),
    pending: boolean(),
    metadata: jsonb('metadata'),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.sourceProfileId).concurrently(),
    index().on(table.targetProfileId).concurrently(),
    index().on(table.relationshipType).concurrently(),
    index().on(table.sourceProfileId, table.pending).concurrently(),
    index().on(table.targetProfileId, table.pending).concurrently(),
    index().on(table.relationshipType, table.pending).concurrently(),
    uniqueIndex().on(
      table.sourceProfileId,
      table.targetProfileId,
      table.relationshipType,
    ),
  ],
);

export const profileRelationshipsRelations = relations(
  profileRelationships,
  ({ one }) => ({
    sourceProfile: one(profiles, {
      fields: [profileRelationships.sourceProfileId],
      references: [profiles.id],
      relationName: 'sourceProfileRelationships',
    }),
    targetProfile: one(profiles, {
      fields: [profileRelationships.targetProfileId],
      references: [profiles.id],
      relationName: 'targetProfileRelationships',
    }),
  }),
);
