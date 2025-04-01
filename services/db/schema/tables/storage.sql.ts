import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const storageSchema = pgSchema('storage');

/**
 * Drizzle definition for Supabase Storage buckets
 * THIS IS NOT INCLUDED IN MIGRATIONS
 */
export const bucketsInStorage = storageSchema.table(
  'buckets',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    owner: uuid('owner'),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    public: boolean('public').default(sql`false`),
    avifAutodetection: boolean('avif_autodetection').default(sql`false`),
    fileSizeLimit: bigint('file_size_limit', { mode: 'number' }),
    allowedMimeTypes: text('allowed_mime_types').array(),
    ownerId: text('owner_id'),
  },
  table => [
    uniqueIndex('buckets_pkey').on(table.id),
    uniqueIndex('bname').on(table.name),
  ],
);

/**
 * Drizzle definition for Supabase Storage objects.
 * THIS IS NOT INCLUDED IN MIGRATIONS
 */
export const objectsInStorage = storageSchema.table(
  'objects',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    bucketId: text('bucket_id'),
    name: text('name'),
    owner: uuid('owner'),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    lastAccessedAt: timestamp('last_accessed_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    metadata: jsonb('metadata'),
    pathTokens: text('path_tokens')
      .array()
      .generatedAlwaysAs(sql`string_to_array(name, '/'::text)`),
    version: text('version'),
    ownerId: text('owner_id'),
    userMetadata: jsonb('user_metadata'),
  },
  table => [
    uniqueIndex('objects_pkey').on(table.id),
    uniqueIndex('bucketid_objname').on(table.bucketId, table.name),
    index('name_prefix_search').on(table.name),
    index('idx_objects_bucket_id_name').on(table.bucketId, table.name),
  ],
);
