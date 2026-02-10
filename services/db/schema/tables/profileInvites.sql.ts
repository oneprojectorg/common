import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { accessRoles } from './access.sql';
import { entityTypeEnum } from './entities.sql';
import { profiles } from './profiles.sql';

/**
 * Profile invites table - tracks pending invitations to profiles.
 *
 * Uses email instead of authUserId since invited users may not exist yet.
 * The profileEntityType is denormalized from profiles for efficient filtering.
 *
 * Invite is pending when acceptedOn is null, accepted when acceptedOn is set.
 */
export const profileInvites = pgTable(
  'profile_invites',
  {
    id: autoId().primaryKey(),
    email: varchar('email', { length: 256 }).notNull(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
      }),
    // Denormalized from profiles for filtering (e.g., "show only org invites")
    profileEntityType: entityTypeEnum('profile_entity_type').notNull(),
    accessRoleId: uuid('access_role_id')
      .notNull()
      .references(() => accessRoles.id, {
        onDelete: 'cascade',
      }),
    inviteeProfileId: uuid('invitee_profile_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
      }),
    message: text('message'),
    // null = pending, set = accepted
    acceptedOn: timestamp('accepted_on', {
      withTimezone: true,
      mode: 'string',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('profile_invites_email_idx').on(table.email),
    index('profile_invites_profile_idx').on(table.profileId),
    index('profile_invites_entity_type_idx').on(table.profileEntityType),
    index('profile_invites_invitee_profile_idx').on(table.inviteeProfileId),
    // Only one pending invite per email per profile
    uniqueIndex('profile_invites_email_profile_pending_idx')
      .on(table.email, table.profileId)
      .where(sql`accepted_on IS NULL`),
  ],
);

export type ProfileInvite = typeof profileInvites.$inferSelect;

export const profileInvitesRelations = relations(profileInvites, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileInvites.profileId],
    references: [profiles.id],
  }),
  accessRole: one(accessRoles, {
    fields: [profileInvites.accessRoleId],
    references: [accessRoles.id],
  }),
  inviteeProfile: one(profiles, {
    fields: [profileInvites.inviteeProfileId],
    references: [profiles.id],
    relationName: 'profileInvite_invitee',
  }),
  inviter: one(profiles, {
    fields: [profileInvites.invitedBy],
    references: [profiles.id],
    relationName: 'profileInvite_inviter',
  }),
}));
