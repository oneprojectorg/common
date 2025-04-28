/**
 * Drizzle definition for Supabase Vault functionality
 * THIS IS NOT INCLUDED IN MIGRATIONS
 */
import { pgSchema, text, uuid } from 'drizzle-orm/pg-core';

const vaultSchema = pgSchema('vault');

export const secrets = vaultSchema.table('secrets', {
  id: uuid('id').defaultRandom().notNull(),
  secret: text('secret').notNull(),
});

export const decryptedSecrets = vaultSchema
  .view('decrypted_secrets', {
    id: uuid('id').defaultRandom().notNull(),
    decryptedSecret: text('decrypted_secret'),
  })
  .existing();
