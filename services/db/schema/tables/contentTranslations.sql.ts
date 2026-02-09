import type { InferModel } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

/**
 * Generic translation cache. Stores translated content for any entity type.
 *
 * Keyed by: contentKey + contentHash + targetLocale
 *
 * @example contentKey values:
 *   "proposal:abc123:default"  — proposal body fragment
 *   "proposal:abc123:title"    — proposal title
 *   "post:abc123"               — post text content
 *   "profile:abc123:bio"       — profile bio
 *   "template-label:field_1"   — template field label
 */
export const contentTranslations = pgTable(
  'content_translations',
  {
    id: autoId().primaryKey(),
    /** Identifies the content source, e.g. "proposal:<id>:<fragment>" */
    contentKey: varchar({ length: 512 }).notNull(),
    /** SHA-256 prefix (16 hex chars) of the source text */
    contentHash: varchar({ length: 16 }).notNull(),
    /** Detected source language, e.g. "EN" */
    sourceLocale: varchar({ length: 10 }),
    /** Target language, e.g. "ES" */
    targetLocale: varchar({ length: 10 }).notNull(),
    /** The translated content string */
    translated: text().notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('uq_content_translations_lookup').on(
      table.contentKey,
      table.contentHash,
      table.targetLocale,
    ),
    index('idx_content_translations_key').on(table.contentKey),
  ],
);

export type ContentTranslation = InferModel<typeof contentTranslations>;
