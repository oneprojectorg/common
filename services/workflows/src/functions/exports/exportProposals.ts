import { get, set } from '@op/cache';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  type ExportStatusData,
  assertUserByAuthId,
  exportDownloadOptions,
  exportFileName,
  exportFilePath,
  exportStatusCacheKey,
  generateProposalsCsv,
  listProposals,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';
import { realtime } from '@op/realtime/server';
import { createSBServiceClient } from '@op/supabase/server';

type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

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
      // Step 2: Fetch proposals
      const proposals = await step.run('fetch-proposals', async () => {
        // Confirm the requester still exists, then hand `listProposals` an
        // auth-shaped user. Every identity path it reaches — `getCurrentProfileId`,
        // `assertUserByAuthId`, `resolveAccessUserIds` — reads `user.id` as an
        // *auth* user id, so passing the `users` row (whose `id` is the database
        // key) silently resolved the wrong caller.
        await assertUserByAuthId(userId);

        const result = await listProposals({
          input: {
            // This call is the whole definition of what an export covers, so
            // what it leaves unsaid matters as much as what it passes. No
            // filters: the same instance has to produce the same file, and a
            // CSV cannot show its reader which filters were active when it was
            // built. No `phaseId`, which resolves to the instance's *current*
            // phase — so an export is not the instance's whole history, and
            // what it holds changes as the instance advances. No `dir`, so
            // rows arrive in the query's own order.
            //
            // `skipAccessCheck` also settles the row set rather than merely
            // skipping a check: the trusted branch takes every phase-scoped
            // non-draft proposal, ignoring the visibility and moderation
            // filters a signed-in caller would get. Drafts are never included,
            // and two admins exporting the same instance get the same rows.
            processInstanceId,
            limit: 1000, // High limit for exports
            skipAccessCheck: true, // Access already verified when export was created
            includeDocumentContent: true, // CSV descriptions come from the full fragments
          },
          user: { id: userId },
        });

        return result.proposals;
      });

      const { content, extension, mimeType } = await step.run(
        'generate-file',
        async () => {
          if (format === 'csv') {
            return {
              content: await generateProposalsCsv(
                proposals as ProposalFromList[],
              ),
              extension: 'csv',
              mimeType: 'text/csv',
            };
          }

          throw new Error(`Unsupported format: ${format}`);
        },
      );

      // Step 4: Upload to Supabase storage
      const { fileName, signedUrl, urlExpiresAt } = await step.run(
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
            .createSignedUrl(
              filePath,
              EXPORT_URL_TTL_SECONDS,
              exportDownloadOptions(fileName),
            );

          if (urlError || !urlData) {
            throw new Error(
              `Failed to create signed URL: ${urlError?.message}`,
            );
          }

          return {
            fileName,
            signedUrl: urlData.signedUrl,
            // Pinned to the signature. This step is memoized, so the write
            // below reuses this value on a retry. Recomputing it there moved
            // the recorded expiry past the real one, and the staleness check
            // trusts the record.
            urlExpiresAt: new Date(
              Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
            ).toISOString(),
          };
        },
      );

      // Step 5: Update status to completed
      await step.run('update-status-completed', async () => {
        await updateExportStatus(exportId, {
          status: 'completed',
          fileName,
          signedUrl,
          urlExpiresAt,
          completedAt: new Date().toISOString(),
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
