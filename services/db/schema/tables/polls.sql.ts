import type { InferModel } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { profiles } from './profiles.sql';
import { users } from './users.sql';

/**
 * Poll status enum - a poll can be open (accepting votes) or closed
 */
export enum PollStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export const pollStatusEnum = pgEnum('poll_status', enumToPgEnum(PollStatus));

/**
 * Poll option stored in the options jsonb array
 */
export type PollOption = {
  text: string;
};

/**
 * Polls table - lightweight poll primitive that can attach to any entity
 */
export const polls = pgTable(
  'polls',
  {
    id: autoId().primaryKey(),

    /** Profile (org/user) this poll belongs to */
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    /** User who created the poll */
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    /** The poll question */
    question: varchar({ length: 500 }).notNull(),

    /** Array of poll options */
    options: jsonb().$type<PollOption[]>().notNull(),

    /** Poll status - open or closed */
    status: pollStatusEnum().default(PollStatus.OPEN).notNull(),

    /** Entity type this poll is attached to (e.g. 'proposal', 'process', 'meeting') */
    targetType: varchar({ length: 100 }).notNull(),

    /** ID of the entity this poll is attached to */
    targetId: uuid('target_id').notNull(),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id),
    index().on(table.profileId),
    index().on(table.createdById),
    index().on(table.status),
    index('polls_target_idx').on(table.targetType, table.targetId),
  ],
);

/**
 * Poll votes table - tracks individual votes on polls
 * Each user can only vote once per poll (upsert pattern for changing votes)
 */
export const pollVotes = pgTable(
  'poll_votes',
  {
    id: autoId().primaryKey(),

    /** The poll being voted on */
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    /** The user who voted */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    /** Index of the selected option (0-based) */
    optionIndex: integer('option_index').notNull(),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id),
    index().on(table.pollId),
    index().on(table.userId),
    unique('poll_votes_poll_user_unique').on(table.pollId, table.userId),
  ],
);

export type Poll = InferModel<typeof polls>;
export type PollVote = InferModel<typeof pollVotes>;
