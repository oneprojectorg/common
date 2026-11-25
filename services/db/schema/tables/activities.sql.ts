import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { organizations } from './organizations.sql';
import { posts } from './posts.sql';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';
import { proposals } from './proposals.sql';

export const activities = pgTable(
  'activities',
  {
    id: autoId().primaryKey(),
    outboxId: uuid().notNull(),
    eventName: varchar({ length: 255 }).notNull(),
    actorProfileId: uuid().references(() => profiles.id, {
      onDelete: 'set null',
    }),
    organizationId: uuid().references(() => organizations.id, {
      onDelete: 'set null',
    }),
    processInstanceId: uuid().references(() => processInstances.id, {
      onDelete: 'set null',
    }),
    proposalId: uuid().references(() => proposals.id, {
      onDelete: 'set null',
    }),
    postId: uuid().references(() => posts.id, {
      onDelete: 'set null',
    }),
    snapshot: jsonb().notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('activities_outbox_id_idx').on(table.outboxId),
    index('activities_organization_id_created_at_id_idx')
      .on(
        table.organizationId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`organization_id IS NOT NULL`),
    index('activities_process_instance_id_created_at_id_idx')
      .on(
        table.processInstanceId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`process_instance_id IS NOT NULL`),
    index('activities_proposal_id_created_at_id_idx')
      .on(
        table.proposalId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`proposal_id IS NOT NULL`),
    index('activities_post_id_created_at_id_idx')
      .on(
        table.postId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`post_id IS NOT NULL`),
    index('activities_actor_profile_id_created_at_id_idx')
      .on(
        table.actorProfileId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`actor_profile_id IS NOT NULL`),
  ],
);

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
