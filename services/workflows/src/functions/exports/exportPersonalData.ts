import {
  collectPersonalData,
  personalDataExportCacheKey,
  personalDataExportFileName,
  personalDataExportFilePath,
  uploadExportFile,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';

import { runExportJob } from './runExportJob';

const { personalDataExportRequested } = Events;

/** Build one data subject's Article 20 export file. */
export const exportPersonalData = inngest.createFunction(
  {
    id: 'exportPersonalData',
  },
  { event: personalDataExportRequested.name },
  async ({ event, step }) => {
    const { exportId, userId } = personalDataExportRequested.schema.parse(
      event.data,
    );

    return runExportJob({
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
        }),
    });
  },
);
