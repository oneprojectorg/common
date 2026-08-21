import { get, set } from '@op/cache';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  type ExportStatusData,
  assertUserByAuthId,
  exportFileName,
  exportFilePath,
  exportStatusCacheKey,
  listProposalsForExport,
  generateProposalsCsv,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';
import { realtime } from '@op/realtime/server';
import { createSBServiceClient } from '@op/supabase/server';

// Helper to merge a partial update into the cached export status. The record is
// seeded in full when the export is requested, so every write here is a patch
// over an existing record rather than a fresh one.
const updateExportStatus = async (
  exportId: string,
  updates: Partial<ExportStatusData>,
) => {
  const key = exportStatusCacheKey(exportId);
  const existing = (await get(key)) as ExportStatusData | null;
  const updated = { ...(existing ?? {}), ...updates };
  await set(key, updated, EXPORT_CACHE_TTL_SECONDS);
};

/**
 * Tell any admin waiting on this export that it has reached a terminal state.
 *
 * Broadcast-only: the cached record written just before this is the source of
 * truth, and the message carries no payload — subscribers re-read
 * `getExportStatus` on receipt.
 *
 * Nothing polls behind this, so a lost broadcast costs correctness rather than
 * latency: the client never sees a terminal state, and the wait ends by
 * reporting a timeout for an export that worked. One way to lose it is to
 * publish before the client has finished subscribing, which an export settling
 * in under a second can easily do. Covering that is not this function's job —
 * every channel re-reads its queries once its join is confirmed, so whatever
 * settled before the join is in that read and whatever settles after arrives
 * here.
 *
 * `realtime.publish` logs and swallows its own failures, so this cannot fail
 * the run or trigger a retry that would rewrite a settled status.
 */
const notifyExportFinished = (exportId: string) =>
  realtime.publish(Channels.proposalExport(exportId), {
    // Identifies the broadcast for client-side dedup; the export id is stable
    // across this run's terminal write, which is the only thing published here.
    mutationId: `export:${exportId}`,
  });

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

    // Step 1: Update status to processing
    await step.run('update-status-processing', async () => {
      await updateExportStatus(exportId, {
        status: 'processing',
        exportId,
        processInstanceId,
        userId,
        format,
        createdAt: new Date().toISOString(),
      });
    });

    try {
      // Step 2: Read every proposal and render the file.
      //
      // Fetching and rendering share one step so the row set never crosses a
      // step boundary. Inngest serializes whatever a step returns into function
      // state, and export rows carry each proposal's full document fragments —
      // the heaviest payload we could hand it. Only the rendered file leaves
      // here, which is what the upload needs anyway.
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

          // What this read leaves unsaid defines what an export covers as much
          // as what it passes. No filters: the same instance has to produce the
          // same file, and a CSV cannot show its reader which filters were
          // active when it was built. No `phaseId`, which resolves to the
          // instance's *current* phase — so an export is not the instance's
          // whole history, and what it holds changes as the instance advances.
          // No `dir` and no `orderBy`, so rows arrive in the query's own order,
          // which is also the only ordering the paged read can keyset.
          //
          // `skipAccessCheck` (applied inside) settles the row set rather than
          // merely skipping a check: the trusted branch takes every
          // phase-scoped non-draft proposal, ignoring the visibility and
          // moderation filters a signed-in caller would get. Drafts are never
          // included, and two admins exporting the same instance get the same
          // rows.
          const { proposals, total, truncated } = await listProposalsForExport({
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

      // Step 4: Upload to Supabase storage
      const { fileName, signedUrl } = await step.run(
        'upload-to-storage',
        async () => {
          // Use service role client to bypass RLS in background job
          const supabase = createSBServiceClient();

          const fileName = exportFileName(extension);
          const filePath = exportFilePath(processInstanceId, fileName);

          // Upload CSV to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from(EXPORTS_BUCKET)
            .upload(filePath, Buffer.from(content), {
              contentType: mimeType,
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          const { data: urlData, error: urlError } = await supabase.storage
            .from(EXPORTS_BUCKET)
            .createSignedUrl(filePath, EXPORT_URL_TTL_SECONDS);

          if (urlError || !urlData) {
            throw new Error(
              `Failed to create signed URL: ${urlError?.message}`,
            );
          }

          return {
            fileName,
            signedUrl: urlData.signedUrl,
          };
        },
      );

      // Step 5: Update status to completed
      await step.run('update-status-completed', async () => {
        await updateExportStatus(exportId, {
          status: 'completed',
          fileName,
          signedUrl,
          urlExpiresAt: new Date(
            Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
          ).toISOString(),
          completedAt: new Date().toISOString(),
          // Carried to the admin so a short file is legible as short. Recorded
          // on every completed export, not only truncated ones, so the counts
          // are available to read back rather than inferred from their absence.
          rowCount,
          total,
          truncated,
        });
      });

      await step.run('notify-export-finished', () =>
        notifyExportFinished(exportId),
      );

      return { exportId, status: 'completed' };
    } catch (error) {
      // Update status to failed
      await step.run('update-status-failed', async () => {
        await updateExportStatus(exportId, {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date().toISOString(),
        });
      });

      await step.run('notify-export-failed', () =>
        notifyExportFinished(exportId),
      );

      throw error;
    }
  },
);
