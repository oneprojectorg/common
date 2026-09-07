import { failedExportPatch, patchExportRecord } from '@op/common';
import type { ChannelName } from '@op/common/realtime';

import { notifyExportChanged } from './notifyExportChanged';

/** Declared structurally so this does not depend on Inngest's handler types. */
interface ExportStepRunner {
  run: (id: string, handler: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * Run one export to a terminal state, reported and broadcast.
 *
 * The `catch` wraps `produce` rather than sitting inside it because that is what
 * guarantees the property both pipelines depend on: export state lives only in a
 * cache with no history, so a run that ends without a terminal status is a file
 * nothing can reach. The error is rethrown, so Inngest still records the failure.
 *
 * `seed` restates the fields the record cannot be read without, in case the
 * request's own write was evicted in between.
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
      patchExportRecord(cacheKey, failedExportPatch(exportId, error)),
    );

    await step.run('notify-export-failed', () => notifyExportChanged(channel));

    throw error;
  }
};
