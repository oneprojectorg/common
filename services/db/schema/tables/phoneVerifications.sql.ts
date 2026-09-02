import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { authUsers } from './authUsers.sql';

// A phone number GoTrue confirmed, in a form this application can revoke.
//
// Membership could read `auth.users.phone_confirmed_at` instead. It reads this
// table so a verification can be withdrawn (`deleted_at`) and attributed
// (`provider`) without touching the auth schema, which we do not own.
//
// The `record_phone_verification` trigger is the only writer. Nothing in the
// application observes a verification, because GoTrue performs it.
export const phoneVerifications = pgTable(
  'phone_verifications',
  {
    id: autoId().primaryKey(),
    authUserId: uuid('auth_user_id')
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    // E.164, as our own schema validates it — not GoTrue's plus-less storage.
    phone: varchar({ length: 32 }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Which provider approved it, so a later vendor change stays auditable.
    provider: varchar({ length: 32 }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Membership asks "has this account verified any number", once per
    // authorized request.
    index().on(table.authUserId),
    // One row per account and number: signing in again re-verifies a number
    // the account already proved.
    uniqueIndex('phone_verifications_auth_user_id_phone_idx').on(
      table.authUserId,
      table.phone,
    ),
  ],
);

export type PhoneVerification = typeof phoneVerifications.$inferSelect;
