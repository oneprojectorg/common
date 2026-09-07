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

/**
 * Render every non-draft proposal in an instance's current phase to a CSV.
 *
 * {@link runExportJob} owns the status reporting and the broadcasts either side
 * of it. What is here is the work: read the proposals, render the file, and
 * upload it.
 */
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
      // The status contract requires all three, so a record missing any of them
      // fails the first read instead of answering it.
      seed: { processInstanceId, userId, format },
      produce: async () => {
        // Read every proposal and render the file.
        //
        // Fetching and rendering share one step so the row set never crosses a
        // step boundary. Inngest serializes whatever a step returns into
        // function state, and export rows carry each proposal's full document
        // fragments — the heaviest payload we could hand it. Only the rendered
        // file leaves here, which is what the upload needs anyway.
        //
        // The cost of merging them is retry granularity: an upload failure
        // re-reads and re-renders rather than resuming from a cached row set.
        // That is the cheaper direction to be wrong in, because the row set is
        // the part that does not fit.
        const { content, extension, mimeType, rowCount, total, truncated } =
          await step.run('fetch-and-generate-file', async () => {
            if (format !== 'csv') {
              throw new Error(`Unsupported format: ${format}`);
            }

            // Confirm the requester still exists, then hand `listProposals` an
            // auth-shaped user. Every identity path it reaches — `getCurrentProfileId`,
            // `assertUserByAuthId`, `resolveAccessUserIds` — reads `user.id` as an
            // *auth* user id, so passing the `users` row (whose `id` is the database
            // key) silently resolved the wrong caller.
            await assertUserByAuthId(userId);

            // What this read leaves unsaid defines what an export covers as
            // much as what it passes. No filters: the same instance has to
            // produce the same file, and a CSV cannot show its reader which
            // filters were active when it was built. No `phaseId`, which
            // resolves to the instance's *current* phase — so an export is not
            // the instance's whole history, and what it holds changes as the
            // instance advances. No `dir` and no `orderBy`, so rows arrive in
            // the query's own order, which is also the only ordering the paged
            // read can keyset.
            //
            // `skipAccessCheck` (applied inside) settles the row set rather
            // than merely skipping a check: the trusted branch takes every
            // phase-scoped non-draft proposal, ignoring the visibility and
            // moderation filters a signed-in caller would get. Drafts are never
            // included, and two admins exporting the same instance get the same
            // rows.
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

          // `uploadExportFile` holds the service-role client that bypasses RLS
          // in a background job, and pins `urlExpiresAt` to the signature it
          // returns. This step is memoized, so a retry reuses that value rather
          // than recomputing an expiry past the real one.
          const { signedUrl, urlExpiresAt } = await uploadExportFile({
            filePath: exportFilePath(processInstanceId, fileName),
            fileName,
            content,
            mimeType,
          });

          return { fileName, signedUrl, urlExpiresAt };
        });

        return {
          ...completion,
          // Carried to the admin so a short file is legible as short. Recorded
          // on every completed export, not only truncated ones, so the counts
          // are available to read back rather than inferred from their absence.
          rowCount,
          total,
          truncated,
        };
      },
    });
  },
);
