import {
  boolean,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');

// Locally declared mirror of Supabase's auth.users so we can expose columns
// (like is_anonymous) that drizzle-orm/supabase doesn't model. drizzle-kit
// only generates migrations for the `public` schema (see drizzle.config.ts
// schemaFilter), so this declaration won't try to ALTER auth.users.
export const authUsers = auth.table('users', {
  id: uuid().primaryKey().notNull(),
  email: varchar({ length: 255 }),
  phone: text().unique(),
  emailConfirmedAt: timestamp('email_confirmed_at', { withTimezone: true }),
  phoneConfirmedAt: timestamp('phone_confirmed_at', { withTimezone: true }),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
});
