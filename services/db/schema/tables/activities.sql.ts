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
    // Plain uuid, no FK: pruning the outbox never blocks on or deletes
    // feed history; replay only needs the key within Inngest's retry
    // window (ADR 0023).
    outboxId: uuid().notNull(),
    eventName: varchar({ length: 255 }).notNull(),
    actorProfileId: uuid().references(() => profiles.id, {
      onDelete: 'set null',
    }),
    organizationId: uuid().references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    processInstanceId: uuid().references(() => processInstances.id, {
      onDelete: 'cascade',
    }),
    proposalId: uuid().references(() => proposals.id, {
      onDelete: 'cascade',
    }),
    postId: uuid().references(() => posts.id, {
      onDelete: 'cascade',
    }),
    snapshot: jsonb().notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('activities_outbox_id_idx').on(table.outboxId),
    // Feed sort per scope: WHERE <scope> = ? ORDER BY created_at DESC, id DESC.
    index('activities_organization_id_created_at_id_idx').on(
      table.organizationId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index('activities_process_instance_id_created_at_id_idx').on(
      table.processInstanceId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index('activities_proposal_id_created_at_id_idx').on(
      table.proposalId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index('activities_post_id_created_at_id_idx').on(
      table.postId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index('activities_actor_profile_id_idx').on(table.actorProfileId),
  ],
);

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
