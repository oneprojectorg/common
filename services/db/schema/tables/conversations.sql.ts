import { index, pgTable, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { decisionPhoneNumbers } from './decisionPhoneNumbers.sql';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export const conversations = pgTable(
  'conversations',
  {
    id: autoId().primaryKey(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    processInstanceId: uuid('process_instance_id').references(
      () => processInstances.id,
      {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      },
    ),
    phoneNumberId: uuid('phone_number_id').references(
      () => decisionPhoneNumbers.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('conversations_profile_created_idx').on(
      table.profileId,
      table.createdAt,
    ),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
