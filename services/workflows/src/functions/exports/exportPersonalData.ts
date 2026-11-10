import {
  collectPersonalData,
  personalDataExportCacheKey,
  personalDataExportFileName,
  personalDataExportFilePath,
  storeExportFile,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';

import { runExportJob } from './runExportJob';

const { personalDataExportRequested, personalDataExportCompleted } = Events;

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

    const result = await runExportJob({
      step,
      exportId,
      cacheKey: personalDataExportCacheKey(exportId),
      channel: Channels.personalDataExport(exportId),
      seed: { userId },
      // One step so the file never crosses a step boundary into Inngest state.
      produce: () =>
        step.run('collect-and-upload', async () => {
          const data = await collectPersonalData({ authUserId: userId });
          const fileName = personalDataExportFileName();

          await storeExportFile({
            filePath: personalDataExportFilePath(userId, fileName),
            content: JSON.stringify(data, null, 2),
            mimeType: 'application/json',
          });

          return {
            fileName,
            truncatedSections: data.truncatedSections,
          };
        }),
    });

    // a separate run, so this one ends and the singleton frees up
    await step.sendEvent('schedule-expiry', {
      name: personalDataExportCompleted.name,
      data: { exportId, userId, fileName: result.fileName },
    });

    return result;
  },
);
