import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export enum PhaseAudience {
  OPEN = 'open',
  INVITE_ONLY = 'invite_only',
}

export const phaseAudienceEnum = pgEnum(
  'phase_audience',
  enumToPgEnum(PhaseAudience),
);

export const processPhases = pgTable(
  'decision_process_phases',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    sortOrder: integer('sort_order').notNull(),

    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Read on every participation check (ADR 0006), so it fails closed by
    // construction: never absent, and invite-only unless set.
    audience: phaseAudienceEnum('audience')
      .notNull()
      .default(PhaseAudience.INVITE_ONLY),

    data: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('decision_process_phases_instance_sort_idx').on(
      table.processInstanceId,
      table.sortOrder,
    ),
    index('decision_process_phases_profile_idx').on(table.profileId),
  ],
);

export type ProcessPhase = typeof processPhases.$inferSelect;
