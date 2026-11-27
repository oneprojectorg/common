import { pgSchema, timestamp, uuid } from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');

// Partial mirror of Supabase's auth.sessions; only columns we read are listed.
export const authSessions = auth.table('sessions', {
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  refreshedAt: timestamp('refreshed_at'),
});
