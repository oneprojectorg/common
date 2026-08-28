import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
import { organizationUsers } from './organizationUsers.sql';
import { organizations } from './organizations.sql';
import { profileUsers } from './profileUsers.sql';
import { profiles } from './profiles.sql';
import { objectsInStorage } from './storage.sql';

/**
 * Which channel a person wants their notifications on.
 *
 * The preference is per account, not per decision process. `whatsapp` is
 * absent on purpose: nothing sends over it yet, and an unused member invites a
 * branch that no code path can reach.
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
}

export const notificationChannelEnum = pgEnum(
  'notification_channel',
  enumToPgEnum(NotificationChannel),
);

export const users = pgTable(
  'users',
  {
    id: autoId().primaryKey(),
    authUserId: uuid()
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    username: varchar({ length: 256 }),
    name: varchar({ length: 256 }),
    email: varchar().unique(),
    about: text(),
    title: varchar({ length: 256 }),
    avatarImageId: uuid().references(() => objectsInStorage.id, {
      onUpdate: 'cascade',
    }),
    lastOrgId: uuid().references(() => organizations.id, {
      onDelete: 'set null',
    }),
    profileId: uuid().references(() => profiles.id, {
      onDelete: 'set null',
    }),
    currentProfileId: uuid().references(() => profiles.id, {
      onDelete: 'set null',
    }),
    tos: boolean(),
    privacy: boolean(),
    // When the user accepted the current Terms of Use / Privacy Policy. Null
    // until they accept the latest version; stamped whenever `tos` / `privacy`
    // are set true. These will eventually replace the `tos` / `privacy` bools.
    tosAcceptedOn: timestamp({ withTimezone: true, mode: 'string' }),
    privacyAcceptedOn: timestamp({ withTimezone: true, mode: 'string' }),
    // Used for measuring when a user completed onboarding
    onboardedAt: timestamp({ withTimezone: true, mode: 'string' }),
    // Which channel this person's notifications go out on. The default keeps
    // every existing row on email, so the column changes no one's delivery
    // until they choose otherwise. A phone number lives on `auth.users`, which
    // Supabase verifies; this column only records the preference.
    notificationChannel: notificationChannelEnum('notification_channel')
      .default(NotificationChannel.EMAIL)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.authUserId).concurrently(),
    index().on(table.profileId).concurrently(),
    index().on(table.avatarImageId),
    index().on(table.lastOrgId),
    index().on(table.currentProfileId),
    index().on(table.email).concurrently(),
    index('users_email_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.email})`)
      .concurrently(),
    index('users_username_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.username})`)
      .concurrently(),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  authUser: one(authUsers, {
    fields: [users.authUserId],
    references: [authUsers.id],
  }),
  organizationUsers: many(organizationUsers),
  profileUsers: many(profileUsers),
  currentOrganization: one(organizations, {
    fields: [users.lastOrgId],
    references: [organizations.id],
  }),
  profile: one(profiles, {
    fields: [users.profileId],
    references: [profiles.id],
  }),
  currentProfile: one(profiles, {
    fields: [users.currentProfileId],
    references: [profiles.id],
  }),
  avatarImage: one(objectsInStorage, {
    fields: [users.avatarImageId],
    references: [objectsInStorage.id],
  }),
}));

export type CommonUser = typeof users.$inferSelect;
