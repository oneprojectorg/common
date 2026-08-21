import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, enumToPgEnum, serviceRolePolicies } from '../../helpers';
import { authUsers } from './authUsers.sql';
import { processInstances } from './processInstances.sql';

export enum ProposalExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export const proposalExportStatusEnum = pgEnum(
  'proposal_export_status',
  enumToPgEnum(ProposalExportStatus),
);

/**
 * Durable record of a proposal CSV export: who requested it, for which
 * process instance, and its terminal outcome. Source of truth for
 * `getExportStatus` — previously export state lived only in a 24h cache
 * record, so a completed export was unrecoverable once it expired (or the
 * cache was unreachable) and nothing durable recorded who exported a file
 * carrying submitter names and email addresses.
 */
export const proposalExports = pgTable(
  'proposal_exports',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // The Supabase auth user id of the caller who requested the export.
    // Access to the export is governed by `assertProfileAccess` against the
    // process instance's profile in the service layer, not by this column —
    // it exists to attribute the export, not to grant access to it.
    requestedByUserId: uuid('requested_by_user_id').references(
      () => authUsers.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),

    // Only 'csv' is supported today, enforced by the tRPC input schema and
    // the Inngest event schema. Kept as text rather than a pg enum so a new
    // format doesn't need an `ALTER TYPE`; nothing here branches on it in SQL.
    format: text('format').notNull(),

    // `$type` only narrows the TypeScript side — `enumToPgEnum` widens the
    // generated column type to `string`, and this is the single boundary
    // where it's pinned back to the enum so no consumer has to cast.
    status: proposalExportStatusEnum('status')
      .$type<ProposalExportStatus>()
      .notNull()
      .default(ProposalExportStatus.PENDING),

    fileName: text('file_name'),
    signedUrl: text('signed_url'),
    urlExpiresAt: timestamp('url_expires_at', { withTimezone: true }),
    errorMessage: text('error_message'),

    // No `updatedAt`: a row moves through a fully-instrumented state machine
    // (pending → processing → completed|failed) where `createdAt` and
    // `completedAt` already stamp the two events anything reads. A generic
    // "last touched" column would also tick on the unread `processing` write.
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`(now() AT TIME ZONE 'utc'::text)`),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    ...serviceRolePolicies,
    // Not `.concurrently()`: this is a brand-new table with zero rows at
    // creation time, so there is no lock-contention risk to avoid — and
    // `migrate.ts` runs every migration inside a transaction, which
    // `CREATE INDEX CONCURRENTLY` cannot execute inside.
    index().on(table.processInstanceId),
  ],
);

export type ProposalExport = typeof proposalExports.$inferSelect;
