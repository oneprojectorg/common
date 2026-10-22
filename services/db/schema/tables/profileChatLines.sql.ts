import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';

export const profileChatLines = pgTable(
  'profile_chat_lines',
  {
    id: autoId().primaryKey(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    phoneNumber: varchar('phone_number', { length: 32 }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('profile_chat_lines_profile_id_uniq').on(table.profileId),
    uniqueIndex('profile_chat_lines_phone_number_uniq').on(table.phoneNumber),
  ],
);

export type ProfileChatLine = typeof profileChatLines.$inferSelect;
