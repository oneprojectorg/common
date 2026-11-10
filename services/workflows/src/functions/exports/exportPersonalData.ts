import {
  collectPersonalData,
  personalDataExportCacheKey,
  personalDataExportFileName,
  personalDataExportFilePath,
  releaseActivePersonalDataExport,
  storeExportFile,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';

import { runExportJob } from './runExportJob';

const { personalDataExportRequested, personalDataExportFileStored } = Events;

export const exportPersonalData = inngest.createFunction(
  {
    id: 'exportPersonalData',
    // one run per user; the request reuses a running export's id
    singleton: { key: 'event.data.userId', mode: 'skip' },
  },
  { event: personalDataExportRequested.name },
  async ({ event, step }) => {
    const { exportId, userId } = personalDataExportRequested.schema.parse(
      event.data,
    );

    try {
      return await runExportJob({
        step,
        exportId,
        cacheKey: personalDataExportCacheKey(exportId),
        channel: Channels.personalDataExport(exportId),
        seed: { userId },
        produce: async () => {
          // Named in its own step, so a retried upload overwrites the same file.
          const fileName = await step.run('name-file', async () =>
            personalDataExportFileName(),
          );

          // One step so the file never crosses a step boundary into Inngest state.
          const truncatedSections = await step.run(
            'collect-and-upload',
            async () => {
              const data = await collectPersonalData({ authUserId: userId });

              await storeExportFile({
                filePath: personalDataExportFilePath(userId, fileName),
                content: JSON.stringify(data, null, 2),
                mimeType: 'application/json',
              });

              return data.truncatedSections;
            },
          );

          // Before any status write, so a failed write cannot keep the file.
          await step.sendEvent('schedule-expiry', {
            name: personalDataExportFileStored.name,
            data: { exportId, userId, fileName },
          });

          return { fileName, truncatedSections };
        },
      });
    } finally {
      await step.run('release-active-export', () =>
        releaseActivePersonalDataExport({ userId, exportId }),
      );
    }
  },
);
