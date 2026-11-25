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
import { profiles } from './profiles.sql';

export const activities = pgTable(
  'activities',
  {
    id: autoId().primaryKey(),
    idempotencyKey: uuid().notNull(),
    actorId: uuid().references(() => profiles.id, {
      onDelete: 'set null',
    }),
    verb: varchar({ length: 255 }).notNull(),
    objectType: varchar({ length: 255 }),
    objectId: uuid(),
    targetType: varchar({ length: 255 }),
    targetId: uuid(),
    snapshot: jsonb().notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('activities_idempotency_key_idx').on(table.idempotencyKey),
    index('activities_object_type_object_id_created_at_id_idx')
      .on(
        table.objectType,
        table.objectId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`object_id IS NOT NULL`),
    index('activities_target_type_target_id_created_at_id_idx')
      .on(
        table.targetType,
        table.targetId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`target_id IS NOT NULL`),
    index('activities_actor_id_created_at_id_idx')
      .on(
        table.actorId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`actor_id IS NOT NULL`),
  ],
);

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
