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
 * Build one data subject's Article 20 export.
 *
 * A background job rather than a request handler because the read spans nine
 * tables and an active organiser's record is large enough to outlast any sane
 * request timeout. The request that starts it returns an id and finishes; this
 * is the only place that knows when the file exists.
 *
 * {@link runExportJob} owns the status reporting and the broadcasts either side
 * of it. What is here is the work: read the subject's record, render it, and
 * upload it.
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
      // `userId` is the whole ownership check on every later read, so it is what
      // the record cannot be read without.
      seed: { userId },
      produce: async () => {
        // Read every section and render the file.
        //
        // Reading and rendering share one step so the row set never crosses a
        // step boundary. Inngest serializes whatever a step returns into
        // function state, and the collected rows carry each proposal's full
        // submitted document — by far the heaviest payload we could hand it.
        // Only the rendered file leaves here, which is what the upload needs
        // anyway.
        //
        // The cost of merging them is retry granularity: an upload failure
        // re-reads and re-renders rather than resuming from a cached row set.
        // That is the cheaper direction to be wrong in, because the row set is
        // the part that does not fit.
        const { content, truncatedSections } = await step.run(
          'collect-personal-data',
          async () => {
            // The subject comes from the event, which the request built from
            // the authenticated session. Nothing here re-derives or widens it.
            const data = await collectPersonalData({ authUserId: userId });

            return {
              // Indented rather than minified. The file is what the subject
              // receives, and Article 20 asks for a format they can actually
              // use. The cost is bytes in a file nobody keeps beyond a day.
              content: JSON.stringify(data, null, 2),
              truncatedSections: data.truncatedSections,
            };
          },
        );

        const completion = await step.run('upload-to-storage', async () => {
          const fileName = personalDataExportFileName();

          // `uploadExportFile` holds the service-role client that bypasses RLS
          // in a background job, and pins `urlExpiresAt` to the signature it
          // returns. This step is memoized, so a retry reuses that value rather
          // than recomputing an expiry past the real one.
          const { signedUrl, urlExpiresAt } = await uploadExportFile({
            filePath: personalDataExportFilePath(userId, fileName),
            fileName,
            content,
            mimeType: 'application/json',
          });

          return { fileName, signedUrl, urlExpiresAt };
        });

        return {
          ...completion,
          // Recorded on every completed export, not only truncated ones, so a
          // reader can tell "complete" from "written before this field existed".
          truncatedSections,
        };
      },
    });
  },
);
