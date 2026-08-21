import {
  EXPORTS_BUCKET,
  EXPORT_URL_TTL_SECONDS,
  assertUserByAuthId,
  exportFileName,
  exportFilePath,
  generateProposalsCsv,
  listProposals,
  nextUrlExpiresAt,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { db, eq } from '@op/db/client';
import { ProposalExportStatus, proposalExports } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { realtime } from '@op/realtime/server';
import { createSBServiceClient } from '@op/supabase/server';

type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

// Helper to patch the export's durable record. Each step only touches the
// columns it owns, so — unlike the read-merge-write this replaced against the
// cache — this is a plain partial UPDATE with no read step.
const updateExportStatus = async (
  exportId: string,
  updates: Partial<typeof proposalExports.$inferInsert>,
) => {
  await db
    .update(proposalExports)
    .set(updates)
    .where(eq(proposalExports.id, exportId));
};

/**
 * Tell any admin waiting on this export that it has reached a terminal state.
 *
 * Broadcast-only: the durable record written just before this is the source
 * of truth, and the message carries no payload — subscribers re-read
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
        status: ProposalExportStatus.PROCESSING,
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
          status: ProposalExportStatus.COMPLETED,
          fileName,
          signedUrl,
          urlExpiresAt: nextUrlExpiresAt(),
          completedAt: new Date(),
          // Clears a message from an earlier failed attempt of this same run
          // (Inngest retries the whole function on a rethrown error, and each
          // step here writes only the columns it owns) — otherwise a run that
          // fails once and then succeeds on retry would durably read
          // `completed` with a stale, contradictory error attached.
          errorMessage: null,
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
          status: ProposalExportStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        });
      });

      await step.run('notify-export-failed', () =>
        notifyExportFinished(exportId),
      );

      throw error;
    }
  },
);
