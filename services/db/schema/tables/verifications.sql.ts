import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { authUsers } from './authUsers.sql';

// What a row proves the account holds.
//
// WhatsApp is not a value. It addresses the same E.164 number as SMS, so a
// number verified over either one is the same fact; which channel we message
// on is a delivery preference on the user, not a property of this row.
export enum VerificationType {
  PHONE = 'phone',
  EMAIL = 'email',
}

export const verificationTypeEnum = pgEnum(
  'verification_type',
  enumToPgEnum(VerificationType),
);

// A contact address GoTrue confirmed, in a form this application can revoke.
//
// Membership could read `auth.users.phone_confirmed_at` instead. It reads this
// table so a verification can be withdrawn (`deleted_at`) and attributed
// (`provider`) without touching the auth schema, which we do not own.
//
// One trigger per source column is the only writer: `record_phone_verification`
// reads `phone_confirmed_at`, and an email equivalent would read
// `email_confirmed_at`. Nothing in the application observes a verification,
// because GoTrue performs it.
//
// Every read must filter on `type`. A row is what admits an account, so a query
// that forgets the predicate answers a question about the wrong credential.
export const verifications = pgTable(
  'verifications',
  {
    id: autoId().primaryKey(),
    authUserId: uuid('auth_user_id')
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    type: verificationTypeEnum('type').notNull(),
    // E.164 for a phone, an address for an email — as our own schema validates
    // them, not GoTrue's plus-less phone storage. Wide enough for the longer of
    // the two, so the length is not a constraint on either.
    identifier: varchar({ length: 320 }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Which provider approved it, so a later vendor change stays auditable.
    provider: varchar({ length: 32 }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Membership asks "has this account verified a number", once per authorized
    // request. `type` leads with `auth_user_id` because no read spans types.
    index().on(table.authUserId, table.type),
    // One row per account, type and address: signing in again re-verifies an
    // address the account already proved.
    uniqueIndex('verifications_auth_user_id_type_identifier_idx').on(
      table.authUserId,
      table.type,
      table.identifier,
    ),
  ],
);

export type Verification = typeof verifications.$inferSelect;
