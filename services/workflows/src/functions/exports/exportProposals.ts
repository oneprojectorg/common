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
  generateProposalsCsv,
  listProposals,
} from '@op/common';
import { Events, inngest } from '@op/events';
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

const { proposalExportRequested } = Events;

export const exportProposals = inngest.createFunction(
  {
    id: 'exportProposals',
  },
  { event: proposalExportRequested.name },
  async ({ event, step }) => {
    // Validate event data
    const { exportId, processInstanceId, userId, format, filters } =
      proposalExportRequested.schema.parse(event.data);

    // Step 1: Update status to processing
    await step.run('update-status-processing', async () => {
      await updateExportStatus(exportId, {
        status: 'processing',
        exportId,
        processInstanceId,
        userId,
        format,
        filters,
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
            processInstanceId,
            // Mirror the list query the export was requested from. Anything
            // omitted here widens the file beyond what the admin was looking at.
            categoryId: filters.categoryId,
            submittedByProfileId: filters.submittedByProfileId,
            votedByProfileId: filters.votedByProfileId,
            status: filters.status,
            dir: filters.dir,
            phase: filters.phase,
            excludeAssignedForReview: filters.excludeAssignedForReview,
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
          status: 'completed',
          fileName,
          signedUrl,
          urlExpiresAt: new Date(
            Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
          ).toISOString(),
          completedAt: new Date().toISOString(),
        });
      });

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

      throw error;
    }
  },
);
