import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { authUsers } from './authUsers.sql';
import { decisionPhoneNumbers } from './decisionPhoneNumbers.sql';

export const SMS_MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type SmsMessageDirection = (typeof SMS_MESSAGE_DIRECTIONS)[number];

export const SMS_MESSAGE_STATUSES = [
  'received',
  'queued',
  'sent',
  'delivered',
  'failed',
] as const;
export type SmsMessageStatus = (typeof SMS_MESSAGE_STATUSES)[number];

export const smsMessages = pgTable(
  'sms_messages',
  {
    id: autoId().primaryKey(),
    phoneNumberId: uuid('phone_number_id').references(
      () => decisionPhoneNumbers.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),
    authUserId: uuid('auth_user_id').references(() => authUsers.id, {
      onUpdate: 'cascade',
      onDelete: 'set null',
    }),
    counterpartE164: varchar('counterpart_e164', { length: 32 }),
    direction: varchar('direction', { length: 16 })
      .notNull()
      .$type<SmsMessageDirection>(),
    body: text('body').notNull(),
    providerSid: text('provider_sid'),
    segments: integer('segments'),
    status: varchar('status', { length: 16 })
      .notNull()
      .default('received')
      .$type<SmsMessageStatus>(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('sms_messages_provider_sid_uniq')
      .on(table.providerSid)
      .where(sql`${table.providerSid} IS NOT NULL`),
    index('sms_messages_line_created_idx').on(
      table.phoneNumberId,
      table.createdAt,
    ),
    check(
      'sms_messages_direction_chk',
      sql`${table.direction} IN ('inbound', 'outbound')`,
    ),
    check(
      'sms_messages_status_chk',
      sql`${table.status} IN ('received', 'queued', 'sent', 'delivered', 'failed')`,
    ),
    check(
      'sms_messages_counterpart_chk',
      sql`${table.authUserId} IS NOT NULL OR ${table.counterpartE164} IS NOT NULL`,
    ),
  ],
);

export type SmsMessage = typeof smsMessages.$inferSelect;
