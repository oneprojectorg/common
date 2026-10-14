import { patchExportRecord } from '@op/common';
import type { ChannelName } from '@op/common/realtime';
import { logger } from '@op/logging';

import { notifyExportChanged } from './notifyExportChanged';

/** Declared structurally so this does not depend on Inngest's handler types. */
interface ExportStepRunner {
  run: (id: string, handler: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * Run one export to a terminal, broadcast status. Export state lives only in the
 * cache, so a run that never reaches `completed` or `failed` is unreachable.
 * `seed` restates the fields a reader needs, in case the request's write was evicted.
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
    // The cause is logged, not recorded: the client sees the record, and a driver
    // error can carry the subject's own rows as query parameters.
    logger.error('Export run failed', { exportId, error });

    await step.run('update-status-failed', () =>
      patchExportRecord(cacheKey, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      }),
    );

    await step.run('notify-export-failed', () => notifyExportChanged(channel));

    throw error;
  }
};
