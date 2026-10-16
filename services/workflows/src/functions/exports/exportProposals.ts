import {
  assertUserByAuthId,
  exportFileName,
  exportFilePath,
  exportStatusCacheKey,
  listProposalsForExport,
  generateProposalsCsv,
  uploadExportFile,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';

import { runExportJob } from './runExportJob';

const { proposalExportRequested } = Events;

export const exportProposals = inngest.createFunction(
  {
    id: 'exportProposals',
  },
  { event: proposalExportRequested.name },
  async ({ event, step }) => {
    // Validate event data
    const { exportId, processInstanceId, userId, format } =
      proposalExportRequested.schema.parse(event.data);

    return runExportJob({
      step,
      exportId,
      cacheKey: exportStatusCacheKey(exportId),
      channel: Channels.proposalExport(exportId),
      // A record missing any of these fails its first read.
      seed: { processInstanceId, userId, format },
      produce: async () => {
        // One step so the rows never enter Inngest state.
        const { content, extension, mimeType, rowCount, total, truncated } =
          await step.run('fetch-and-generate-file', async () => {
            if (format !== 'csv') {
              throw new Error(`Unsupported format: ${format}`);
            }

            await assertUserByAuthId(userId);

            // Unfiltered on purpose: every non-draft proposal in the current
            // phase, so every admin gets the same file.
            const { proposals, total, truncated } =
              await listProposalsForExport({
                processInstanceId,
                userId,
              });

            return {
              content: await generateProposalsCsv(proposals),
              extension: 'csv',
              mimeType: 'text/csv',
              rowCount: proposals.length,
              total,
              truncated,
            };
          });

        const completion = await step.run('upload-to-storage', async () => {
          const fileName = exportFileName(extension);

          const { signedUrl, urlExpiresAt } = await uploadExportFile({
            filePath: exportFilePath(processInstanceId, fileName),
            fileName,
            content,
            mimeType,
          });

          return { fileName, signedUrl, urlExpiresAt };
        });

        return { ...completion, rowCount, total, truncated };
      },
    });
  },
);
