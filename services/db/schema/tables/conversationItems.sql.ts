import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { conversations } from './conversations.sql';
import { smsMessages } from './smsMessages.sql';

export const CONVERSATION_ITEM_KINDS = [
  'message',
  'tool_call',
  'tool_output',
  'command',
] as const;
export type ConversationItemKind = (typeof CONVERSATION_ITEM_KINDS)[number];

export const CONVERSATION_ITEM_ROLES = ['user', 'assistant'] as const;
export type ConversationItemRole = (typeof CONVERSATION_ITEM_ROLES)[number];

export const conversationItems = pgTable(
  'conversation_items',
  {
    id: autoId().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    runId: uuid('run_id'),
    agentId: text('agent_id'),
    kind: varchar('kind', { length: 16 })
      .notNull()
      .$type<ConversationItemKind>(),
    role: varchar('role', { length: 16 }).$type<ConversationItemRole>(),
    content: jsonb('content').notNull(),
    smsMessageId: uuid('sms_message_id').references(() => smsMessages.id, {
      onUpdate: 'cascade',
      onDelete: 'set null',
    }),
    promptVersion: text('prompt_version'),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('conversation_items_conversation_created_idx').on(
      table.conversationId,
      table.createdAt,
    ),
    check(
      'conversation_items_kind_chk',
      sql`${table.kind} IN ('message', 'tool_call', 'tool_output', 'command')`,
    ),
    check(
      'conversation_items_role_chk',
      sql`${table.role} IS NULL OR ${table.role} IN ('user', 'assistant')`,
    ),
    check(
      'conversation_items_message_role_chk',
      sql`(${table.kind} = 'message') = (${table.role} IS NOT NULL)`,
    ),
  ],
);

export type ConversationItem = typeof conversationItems.$inferSelect;
