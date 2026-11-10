import { patchExportRecord } from '@op/common';
import type { ChannelName } from '@op/common/realtime';
import { logger } from '@op/logging';

import { notifyExportChanged } from './notifyExportChanged';

interface ExportStepRunner {
  run: (id: string, handler: () => Promise<unknown>) => Promise<unknown>;
}

// `seed`: the fields a reader needs beyond what the run itself writes.
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
  // On every patch, so an evicted record comes back whole.
  const restore = { ...seed, exportId };

  await step.run('update-status-processing', () =>
    patchExportRecord(cacheKey, { ...restore, status: 'processing' }),
  );

  try {
    await step.run('notify-export-processing', () =>
      notifyExportChanged(channel),
    );

    const completion = await produce();

    await step.run('update-status-completed', () =>
      patchExportRecord(cacheKey, {
        ...restore,
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
    // Logged, not recorded: the error can contain the user's data.
    logger.error('Export run failed', { exportId, error });

    await step.run('update-status-failed', () =>
      patchExportRecord(cacheKey, {
        ...restore,
        status: 'failed',
        completedAt: new Date().toISOString(),
      }),
    );

    await step.run('notify-export-failed', () => notifyExportChanged(channel));

    throw error;
  }
};
