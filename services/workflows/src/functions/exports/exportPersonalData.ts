import {
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS,
  collectPersonalData,
  expirePersonalDataExport,
  personalDataExportCacheKey,
  personalDataExportFileName,
  personalDataExportFilePath,
  uploadExportFile,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';

import { runExportJob } from './runExportJob';

const { personalDataExportRequested } = Events;

export const exportPersonalData = inngest.createFunction(
  {
    id: 'exportPersonalData',
  },
  { event: personalDataExportRequested.name },
  async ({ event, step }) => {
    const { exportId, userId } = personalDataExportRequested.schema.parse(
      event.data,
    );

    // read back from the memoized step on every replay
    let fileName: string | undefined;

    const result = await runExportJob({
      step,
      exportId,
      cacheKey: personalDataExportCacheKey(exportId),
      channel: Channels.personalDataExport(exportId),
      seed: { userId },
      // One step so the file never crosses a step boundary into Inngest state.
      produce: async () => {
        const produced = await step.run('collect-and-upload', async () => {
          const data = await collectPersonalData({ authUserId: userId });
          const fileName = personalDataExportFileName();

          const { signedUrl, urlExpiresAt } = await uploadExportFile({
            filePath: personalDataExportFilePath(userId, fileName),
            fileName,
            content: JSON.stringify(data, null, 2),
            mimeType: 'application/json',
          });

          return {
            fileName,
            signedUrl,
            urlExpiresAt,
            truncatedSections: data.truncatedSections,
          };
        });
        fileName = produced.fileName;
        return produced;
      },
    });

    // The file holds everything about the user, so it is kept only as long as
    // it is offered. The app retires the offer on the same clock.
    await step.sleep('hold-file', PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS);

    if (fileName) {
      const expiring = fileName;
      await step.run('expire-file', () =>
        expirePersonalDataExport({ exportId, userId, fileName: expiring }),
      );
    }

    return result;
  },
);
