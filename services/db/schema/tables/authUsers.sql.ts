import {
  boolean,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');

// Partial mirror of Supabase's auth.users; only columns we read are listed.
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
