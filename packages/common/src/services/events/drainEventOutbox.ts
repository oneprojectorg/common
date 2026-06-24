import { and, asc, db, eq, isNull, lt, sql } from '@op/db/client';
import { eventOutbox } from '@op/db/schema';
import { type OutboxEvent, inngest } from '@op/events';

const DEFAULT_BATCH_SIZE = 100;

// Soft dead-letter cap. A row stuck in failure past this attempt count gets
// skipped by the drainer so it doesn't pin the partial index forever; a
// human reads `last_error` and either fixes the cause or deletes the row.
const MAX_ATTEMPTS = 100;

export interface DrainEventOutboxOptions {
  batchSize?: number;
}

export interface DrainEventOutboxResult {
  attempted: number;
  delivered: number;
  failed: number;
}

/**
 * Publishes pending outbox events to Inngest in a single transactional batch.
 *
 * Picks the next `batchSize` undelivered rows in created-at order, locking
 * them with FOR UPDATE SKIP LOCKED so concurrent drainers (or a still-running
 * previous tick) never publish the same event twice. Each successful send
 * stamps `delivered_at`; each failure increments `attempts` and records
 * `last_error`, leaving the row pending so the next tick retries it.
 *
 * The whole batch shares one transaction. A drainer crash leaves every row
 * un-stamped — the next tick picks them up unchanged. To avoid duplicate
 * downstream processing if Inngest succeeded just before the crash, we pass
 * the outbox row id as the Inngest event `id`; Inngest dedupes events with
 * the same id, so the re-publish is a no-op at the function level.
 */
export const drainEventOutbox = async (
  options: DrainEventOutboxOptions = {},
): Promise<DrainEventOutboxResult> => {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: eventOutbox.id,
        eventName: eventOutbox.eventName,
        eventData: eventOutbox.eventData,
      })
      .from(eventOutbox)
      .where(
        and(
          isNull(eventOutbox.deliveredAt),
          lt(eventOutbox.attempts, MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(eventOutbox.createdAt))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    let delivered = 0;
    let failed = 0;

    for (const row of rows) {
      const now = new Date().toISOString();

      try {
        // event_outbox is opaque jsonb at the DB boundary; the row was
        // type-checked on insert via outboxSend(OutboxEvent). One cast back
        // to that union is the single re-typing point.
        //
        // `id: row.id` makes this delivery idempotent at Inngest: if we
        // crash between `inngest.send` succeeding and `UPDATE delivered_at`
        // committing, the next tick republishes the same outbox row id and
        // Inngest dedupes it instead of double-running downstream functions.
        await inngest.send({
          id: row.id,
          name: row.eventName,
          data: row.eventData,
        } as OutboxEvent & { id: string });

        await tx
          .update(eventOutbox)
          .set({
            deliveredAt: now,
            lastAttemptAt: now,
            attempts: sql`${eventOutbox.attempts} + 1`,
          })
          .where(eq(eventOutbox.id, row.id));

        delivered += 1;
      } catch (error) {
        await tx
          .update(eventOutbox)
          .set({
            attempts: sql`${eventOutbox.attempts} + 1`,
            lastAttemptAt: now,
            lastError: errorMessage(error),
          })
          .where(eq(eventOutbox.id, row.id));

        failed += 1;
      }
    }

    return {
      attempted: rows.length,
      delivered,
      failed,
    };
  });
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};
