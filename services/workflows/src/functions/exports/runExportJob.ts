import { failedExportPatch, patchExportRecord } from '@op/common';
import type { ChannelName } from '@op/common/realtime';

import { notifyExportChanged } from './notifyExportChanged';

/**
 * The slice of Inngest's step tools this runner uses.
 *
 * Declared structurally so the runner does not depend on Inngest's handler
 * types, which are generic over the whole event catalogue. Every step here
 * writes a record or publishes a broadcast, so none of them has a return value
 * the caller reads.
 */
interface ExportStepRunner {
  run: (id: string, handler: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * Run one export to a terminal state, reported and broadcast.
 *
 * Both export pipelines share this shape, and both depend on the same property:
 * an export always ends in a record the client can read as finished, and always
 * says so on its channel. Export state lives only in a cache with no history, so
 * a run that ends without writing a terminal status is a file nothing can reach
 * — the client waits out its timeout on a run that succeeded, and the id it
 * needed goes with the timeout.
 *
 * The `catch` is what guarantees that, which is why it wraps `produce` rather
 * than sitting inside it. Whatever a pipeline's own steps throw, the record ends
 * `failed` and the waiting client hears about it. The error is rethrown after,
 * so Inngest still records the run as failed and retries it.
 *
 * The processing write restates `seed` rather than patching `status` alone. The
 * request seeds the record, but the cache is the only store, and an eviction in
 * between would otherwise leave a record carrying a status and nothing to
 * identify it — unparseable, and so unreadable for the rest of its day.
 *
 * @param step - Inngest's step tools. Each write is its own step, so a retry
 *   does not repeat a status the run already reported.
 * @param exportId - The run. Written into the record and handed back.
 * @param cacheKey - Where the record lives. The pipeline owns its key format.
 * @param channel - The run's own broadcast channel.
 * @param seed - The fields the record cannot be read without, restated on the
 *   processing write.
 * @param produce - The pipeline's own work: reads, rendering, and the upload. It
 *   declares its own steps and returns the fields that describe the finished
 *   file.
 * @returns The completed run, which is what the Inngest function returns.
 */
export const runExportJob = async ({
  step,
  exportId,
  cacheKey,
  channel,
  seed,
  produce,
}: {
  step: ExportStepRunner;
  exportId: string;
  cacheKey: string;
  channel: ChannelName;
  seed: Record<string, unknown>;
  produce: () => Promise<Record<string, unknown>>;
}): Promise<{ exportId: string; status: 'completed' }> => {
  await step.run('update-status-processing', () =>
    patchExportRecord(cacheKey, {
      ...seed,
      exportId,
      status: 'processing',
      createdAt: new Date().toISOString(),
    }),
  );

  try {
    await step.run('notify-export-processing', () =>
      notifyExportChanged(channel),
    );

    const completion = await produce();

    await step.run('update-status-completed', () =>
      patchExportRecord(cacheKey, {
        ...completion,
        status: 'completed',
        completedAt: new Date().toISOString(),
      }),
    );

    await step.run('notify-export-finished', () =>
      notifyExportChanged(channel),
    );

    return { exportId, status: 'completed' };
  } catch (error) {
    await step.run('update-status-failed', () =>
      patchExportRecord(cacheKey, failedExportPatch(error)),
    );

    await step.run('notify-export-failed', () => notifyExportChanged(channel));

    throw error;
  }
};
