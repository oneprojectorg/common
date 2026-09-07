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

/**
 * Build one data subject's Article 20 export. A background job because the read
 * spans nine tables and an active organiser's record outlasts any request
 * timeout. {@link runExportJob} owns the status reporting either side of it.
 */
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
      produce: async () => {
        // Reading and rendering share one step so the rows never cross a step
        // boundary: Inngest serializes a step's return into function state, and
        // the rows carry every proposal's full submitted document. The cost is
        // that an upload failure re-reads rather than resuming.
        const { content, truncatedSections } = await step.run(
          'collect-personal-data',
          async () => {
            const data = await collectPersonalData({ authUserId: userId });

            return {
              // Indented: the file is what the subject receives, and Article 20
              // asks for a format they can use.
              content: JSON.stringify(data, null, 2),
              truncatedSections: data.truncatedSections,
            };
          },
        );

        const completion = await step.run('upload-to-storage', async () => {
          const fileName = personalDataExportFileName();

          const { signedUrl, urlExpiresAt } = await uploadExportFile({
            filePath: personalDataExportFilePath(userId, fileName),
            fileName,
            content,
            mimeType: 'application/json',
          });

          return { fileName, signedUrl, urlExpiresAt };
        });

        return { ...completion, truncatedSections };
      },
    });
  },
);
