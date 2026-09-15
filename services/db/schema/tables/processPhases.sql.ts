import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

/**
 * A phase of a decision process instance.
 *
 * Phases used to live as an array on `processInstances.instanceData`, where a
 * phase had no identity and its order *was* its array index. Everything that
 * referenced one held a bare `varchar` with no foreign key, so editing that
 * array could silently dangle review assignments, reviews and transitions.
 *
 * See `docs/adr/0005-phases-are-entities-with-their-own-profiles.md`.
 */
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

    /**
     * Position in the process. Contiguous from 0; a reorder rewrites the run.
     *
     * A column rather than a `data` key because the rail orders by it in SQL —
     * the root `CLAUDE.md` forbids sorting a result set in JavaScript, since a
     * sort applied after a paginated fetch only orders the current page.
     *
     * Deliberately *not* unique with `process_instance_id`: a reorder swaps two
     * positions in one statement, which a non-deferrable unique constraint
     * rejects, and Drizzle's `unique()` cannot express `DEFERRABLE INITIALLY
     * DEFERRED`. The reorder path is the single writer and owns contiguity.
     */
    sortOrder: integer('sort_order').notNull(),

    /**
     * The phase's own profile, so a phase can hold `profile_users` and role
     * grants — the same shape `processInstances.profileId` uses.
     *
     * Nullable while `EntityType.PHASE` and the minting path land separately;
     * see ADR 0005. `set null` so a phase survives losing its profile, which is
     * what tombstoning a profile leaves behind.
     */
    profileId: uuid('profile_id').references(() => profiles.id, {
      onUpdate: 'cascade',
      onDelete: 'set null',
    }),

    /**
     * Everything else about the phase: `name`, `startAt` / `endAt`, the
     * capability `rules`, and the proposal and rubric templates.
     *
     * One column rather than several. The argument for splitting a jsonb blob
     * into columns was made about `instanceData`, where genuinely unrelated
     * concerns shared one read-modify-write; a phase row is already scoped to
     * one coherent thing. Section saves stay independent by merging in the
     * statement — `SET data = data || $1::jsonb` — which is a shallow
     * server-side merge, so writing the rubric never reads the template.
     *
     * Defaults to `{}` rather than null so that merge works on a row that has
     * never been written to.
     */
    data: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Serves lookups on `process_instance_id` alone too, via the leading column.
    index('dpp_instance_sort_idx').on(table.processInstanceId, table.sortOrder),
    // Deliberately not `.concurrently()`. Most tables here carry it, but they
    // were baselined rather than migrated, so none of them ever emitted a
    // `CREATE INDEX CONCURRENTLY` into a migration. This table would be the
    // first, and that statement cannot run inside a transaction block — which
    // is where the migrator puts it. The table is new and empty, so a plain
    // index is instant and concurrency buys nothing.
    index('dpp_profile_idx').on(table.profileId),
  ],
);

export type ProcessPhase = typeof processPhases.$inferSelect;
